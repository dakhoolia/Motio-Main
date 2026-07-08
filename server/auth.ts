import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import connectPgSimple from "connect-pg-simple";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { storage } from "./storage";
import { pool } from "./db";
import { User, passwordSchema } from "@shared/schema";
import { crypto, encryptField, decryptField } from "./crypto";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    pendingMfaUserId?: number;
  }
}

// Accept the previous/next 30s step to tolerate clock drift
authenticator.options = { window: 1 };

const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Koden må være 6 sifre"),
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Per-account lockout (in addition to the per-IP rate limit above) ─────────
// After MAX_FAILED consecutive failures for a username, lock it for LOCK_MS.
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

function isLocked(username: string): boolean {
  const entry = failedLogins.get(username);
  return !!entry && entry.lockedUntil > Date.now();
}

function recordFailure(username: string) {
  const entry = failedLogins.get(username) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILED) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  failedLogins.set(username, entry);
}

function recordSuccess(username: string) {
  failedLogins.delete(username);
}

setInterval(() => {
  const now = Date.now();
  Array.from(failedLogins.entries()).forEach(([key, entry]) => {
    if (entry.lockedUntil !== 0 && entry.lockedUntil < now) failedLogins.delete(key);
  });
}, 60 * 1000);

export function setupAuth(app: Express) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionSettings: session.SessionOptions = {
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // sliding expiry: active users stay logged in
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24h idle timeout, refreshed on activity
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        if (isLocked(username)) {
          return done(null, false);
        }
        const user = await storage.getUserByUsername(username);
        if (!user || !user.isActive || !(await crypto.compare(password, user.password))) {
          recordFailure(username);
          return done(null, false);
        }
        recordSuccess(username);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserWithRole(id);
      // Deactivated accounts lose access immediately, even with a live session
      if (!user || user.isActive === false) return done(null, false);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/login", loginRateLimit, (req, res, next) => {
    passport.authenticate("local", (err: any, user: User) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      // MFA-enabled accounts get a half-open session: password verified,
      // but no login until the TOTP code is confirmed.
      if (user.totpEnabled) {
        req.session.pendingMfaUserId = user.id;
        return res.json({ mfaRequired: true });
      }

      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        const userWithRole = await storage.getUserWithRole(user.id);
        res.json(userWithRole);
      });
    })(req, res, next);
  });

  // ── MFA: second login step ──────────────────────────────────────────────────
  app.post("/api/auth/mfa/login", loginRateLimit, async (req, res, next) => {
    const pendingId = req.session.pendingMfaUserId;
    if (!pendingId) return res.status(401).json({ message: "No pending MFA login" });

    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const user = await storage.getUser(pendingId);
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      delete req.session.pendingMfaUserId;
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!authenticator.verify({ token: parsed.data.code, secret: decryptField(user.totpSecret) })) {
      return res.status(401).json({ message: "Ugyldig kode" });
    }

    delete req.session.pendingMfaUserId;
    req.login(user, async (loginErr) => {
      if (loginErr) return next(loginErr);
      const userWithRole = await storage.getUserWithRole(user.id);
      res.json(userWithRole);
    });
  });

  // ── MFA: setup (generate secret + QR, pending until verified) ──────────────
  app.post("/api/auth/mfa/setup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser((req.user as User).id);
    if (!user) return res.sendStatus(404);
    if (user.totpEnabled) return res.status(400).json({ message: "MFA er allerede aktivert" });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.username, "Motio", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Stored encrypted; totpEnabled stays false until the user verifies a code
    await storage.updateUser(user.id, { totpSecret: encryptField(secret) });

    res.json({ otpauthUrl, qrDataUrl, secret });
  });

  // ── MFA: confirm setup with a valid code ────────────────────────────────────
  app.post("/api/auth/mfa/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const user = await storage.getUser((req.user as User).id);
    if (!user?.totpSecret) return res.status(400).json({ message: "Start MFA-oppsett først" });

    if (!authenticator.verify({ token: parsed.data.code, secret: decryptField(user.totpSecret) })) {
      return res.status(400).json({ message: "Ugyldig kode — prøv igjen" });
    }

    await storage.updateUser(user.id, { totpEnabled: true });
    await storage.createAuditLog({
      userId: user.id,
      action: "mfa_enabled",
      entity: "user",
      entityId: user.id,
    });

    res.json({ enabled: true });
  });

  // ── MFA: disable (requires a valid current code) ─────────────────────────────
  app.post("/api/auth/mfa/disable", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const user = await storage.getUser((req.user as User).id);
    if (!user?.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ message: "MFA er ikke aktivert" });
    }

    if (!authenticator.verify({ token: parsed.data.code, secret: decryptField(user.totpSecret) })) {
      return res.status(400).json({ message: "Ugyldig kode" });
    }

    await storage.updateUser(user.id, { totpEnabled: false, totpSecret: null });
    await storage.createAuditLog({
      userId: user.id,
      action: "mfa_disabled",
      entity: "user",
      entityId: user.id,
    });

    res.json({ enabled: false });
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.sendStatus(200));
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userWithRole = await storage.getUserWithRole((req.user as User).id);
    res.json(userWithRole);
  });

  app.post("/api/auth/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { currentPassword, newPassword } = req.body;

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const user = await storage.getUser((req.user as User).id);
    if (!user) return res.sendStatus(404);

    if (!user.mustChangePassword) {
      if (!currentPassword || !(await crypto.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
    }

    const hashedPassword = await crypto.hash(newPassword);
    await storage.updateUser(user.id, { password: hashedPassword, mustChangePassword: false });

    // Revoke every other session for this user (stolen/old devices log out)
    await storage.deleteUserSessions(user.id, req.sessionID);

    await storage.createAuditLog({
      userId: user.id,
      action: "password_changed",
      entity: "user",
      entityId: user.id,
    });

    req.logout((err) => {
      if (err) return res.sendStatus(500);
      req.login(user, async (loginErr) => {
        if (loginErr) return res.sendStatus(500);
        const updatedUser = await storage.getUserWithRole(user.id);
        res.json(updatedUser);
      });
    });
  });
}
