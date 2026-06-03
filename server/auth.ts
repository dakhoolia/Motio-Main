import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User } from "@shared/schema";
import createMemoryStore from "memorystore";
import { crypto } from "./crypto";

const MemoryStore = createMemoryStore(session);

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r3pl1t_s3cr3t_k3y_123",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60 * 1000,
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
        const user = await storage.getUserByUsername(username);
        if (!user || !user.isActive || !(await crypto.compare(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
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
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, async (err) => {
        if (err) return next(err);
        const userWithRole = await storage.getUserWithRole(user.id);
        res.json(userWithRole);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
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
    
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    const user = await storage.getUser((req.user as User).id);
    if (!user) return res.sendStatus(404);

    if (!user.mustChangePassword) {
      if (!currentPassword || !(await crypto.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
    }

    const hashedPassword = await crypto.hash(newPassword);
    await storage.updateUser(user.id, { 
      password: hashedPassword, 
      mustChangePassword: false 
    });

    await storage.createAuditLog({
      userId: user.id,
      action: 'password_changed',
      entity: 'user',
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
