import type { Request, Response, NextFunction } from "express";
import type { User, Role } from "@shared/schema";
import fs from "fs";

type UserWithRole = User & { role: Role | null };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as UserWithRole;
    if (!user.role || !allowedRoles.includes(user.role.name)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

// ── CSRF defense-in-depth: Origin check on state-changing requests ───────────
// The session cookie is SameSite=Lax (blocks cross-site POSTs in modern
// browsers); this adds a second layer per OWASP guidance. Requests without an
// Origin header (curl, server-to-server, same-origin GET navigations) pass.
export function verifyOrigin(req: Request, res: Response, next: NextFunction) {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!mutating) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.headers.host) {
      return res.status(403).json({ message: "Cross-origin request rejected" });
    }
  } catch {
    return res.status(403).json({ message: "Invalid Origin header" });
  }
  next();
}

// ── Upload validation: verify image magic bytes, not client-declared MIME ────
const IMAGE_SIGNATURES: Array<{ check: (b: Buffer) => boolean }> = [
  { check: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },                              // JPEG
  { check: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },             // PNG
  { check: b => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },  // WebP
  { check: b => b.slice(0, 4).toString() === "GIF8" },                                          // GIF
];

export function isValidImageFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return IMAGE_SIGNATURES.some(sig => sig.check(buf));
  } catch {
    return false;
  }
}

// Express middleware: reject (and delete) uploads that aren't real images.
// Blocks e.g. SVG-with-script or renamed executables that pass MIME filters.
export function validateUploadedImage(req: Request, res: Response, next: NextFunction) {
  if (req.file && !isValidImageFile(req.file.path)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "Invalid image file. Only JPEG, PNG, WebP and GIF are allowed." });
  }
  next();
}
