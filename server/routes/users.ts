import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { crypto } from "../crypto";
import { requireAuth, requireRole, validateUploadedImage } from "../middleware";
import { ROLE_NAMES, passwordSchema, type User } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

const { ADMIN } = ROLE_NAMES;

const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, _file, cb) => {
      const userId = (req.user as User).id;
      cb(null, `avatar-${userId}-${Date.now()}.jpg`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

export const usersRouter = Router();

usersRouter.post("/", requireRole(ADMIN), async (req, res) => {
  try {
    const input = z.object({
      username: z.string().min(2),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      roleId: z.number(),
      password: passwordSchema,
    }).parse(req.body);

    const hashedPassword = await crypto.hash(input.password);
    const user = await storage.createUser({
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      name: `${input.firstName} ${input.lastName}`,
      email: input.email,
      phone: input.phone || null,
      password: hashedPassword,
      roleId: input.roleId,
      isActive: true,
      mustChangePassword: true,
    });

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "user_created",
      entity: "user",
      entityId: user.id,
      newValue: JSON.stringify({ username: user.username, email: user.email, roleId: user.roleId }),
    });

    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Username or email already exists" });
    }
    throw err;
  }
});

usersRouter.put("/:id", requireRole(ADMIN), async (req, res) => {
  const id = Number(req.params.id);
  const updates = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    roleId: z.number().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);

  const oldUser = await storage.getUser(id);
  if (!oldUser) return res.sendStatus(404);

  const updateData: any = { ...updates };
  if (updates.firstName || updates.lastName) {
    updateData.name = `${updates.firstName || oldUser.firstName} ${updates.lastName || oldUser.lastName}`;
  }

  const user = await storage.updateUser(id, updateData);

  // Deactivation revokes all of the user's sessions immediately
  if (updates.isActive === false) {
    await storage.deleteUserSessions(id);
  }

  await storage.createAuditLog({
    userId: (req.user as User).id,
    action: "user_updated",
    entity: "user",
    entityId: id,
    oldValue: JSON.stringify({ email: oldUser.email, roleId: oldUser.roleId, isActive: oldUser.isActive }),
    newValue: JSON.stringify(updates),
  });

  res.json(user);
});

usersRouter.put("/:id/reset-password", requireRole(ADMIN), async (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = z.object({ newPassword: passwordSchema }).parse(req.body);

  const user = await storage.getUser(id);
  if (!user) return res.sendStatus(404);

  const hashedPassword = await crypto.hash(newPassword);
  await storage.updateUser(id, { password: hashedPassword, mustChangePassword: true });

  // Admin reset revokes all of the target user's sessions
  await storage.deleteUserSessions(id);

  await storage.createAuditLog({
    userId: (req.user as User).id,
    action: "password_reset",
    entity: "user",
    entityId: id,
  });

  res.json({ message: "Password reset successfully" });
});

usersRouter.put("/:id/reset-mfa", requireRole(ADMIN), async (req, res) => {
  const id = Number(req.params.id);
  const user = await storage.getUser(id);
  if (!user) return res.sendStatus(404);

  await storage.updateUser(id, { totpEnabled: false, totpSecret: null });

  await storage.createAuditLog({
    userId: (req.user as User).id,
    action: "mfa_reset_by_admin",
    entity: "user",
    entityId: id,
  });

  res.json({ message: "MFA reset successfully" });
});

usersRouter.post("/me/avatar", requireAuth, avatarUpload.single("avatar"), validateUploadedImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const userId = (req.user as User).id;
  const existing = await storage.getUser(userId);
  if (existing?.avatarUrl) {
    const oldPath = path.join(process.cwd(), existing.avatarUrl.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const updated = await storage.updateUser(userId, { avatarUrl });
  res.json(updated);
});

usersRouter.delete("/me/avatar", requireAuth, async (req, res) => {
  const userId = (req.user as User).id;
  const existing = await storage.getUser(userId);
  if (existing?.avatarUrl) {
    const oldPath = path.join(process.cwd(), existing.avatarUrl.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const updated = await storage.updateUser(userId, { avatarUrl: null });
  res.json(updated);
});
