import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { verifyOrigin } from "./middleware";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === "production";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    // CSP only in production — the Vite dev client needs inline scripts/HMR.
    // /embed/:slug is excluded below: it carries its own inline script/styles.
    contentSecurityPolicy: false,
    // Frame policy is set per-route below (embed pages must be frameable)
    frameguard: false,
    // Uploads/embed content is consumed cross-origin by dealer websites
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

if (isProd) {
  const csp = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind/Radix inline styles
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/embed/")) return next();
    csp(req, res, next);
  });
}

// Frame policy: embed pages may be framed anywhere; everything else may not
app.use((req, res, next) => {
  if (req.path.startsWith("/embed/")) {
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
  } else {
    res.setHeader("X-Frame-Options", "DENY");
  }
  // The app uses no camera/mic/geolocation — deny them outright
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Login has its own stricter limiter in auth.ts
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please slow down" },
  }),
);
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/public", publicLimiter);
app.use("/embed", publicLimiter);

// ── CSRF defense-in-depth: reject cross-origin state-changing requests ───────
app.use("/api", verifyOrigin);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log metadata only — response bodies may contain PII or credentials
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // Validation errors → 400 with the first human-readable message
    if (err?.name === "ZodError" && Array.isArray(err.errors)) {
      return res.status(400).json({ message: err.errors[0]?.message ?? "Ugyldig forespørsel" });
    }

    const status = err.status || err.statusCode || 500;
    console.error("Internal Server Error:", err);

    // Never leak internal error details on 5xx — log them server-side only
    const message = status < 500 ? err.message || "Request failed" : "Internal Server Error";
    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
