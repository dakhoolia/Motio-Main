import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { crypto } from "./crypto";
import { requireAuth, requireRole } from "./middleware";
import { api } from "@shared/routes";
import { ROLE_NAMES, type User } from "@shared/schema";
import { photos as photosTable } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";
import path from "path";
import fs from "fs";
import express from "express";

import { showroomRouter } from "./routes/showroom";
import { embedRouter } from "./routes/embed";
import { usersRouter } from "./routes/users";
import { vehiclesRouter } from "./routes/vehicles";
import { tasksRouter } from "./routes/tasks";
import { salesRouter } from "./routes/sales";
import { createChatRouter } from "./routes/chat";
import { contractsRouter, contractTemplatesRouter } from "./routes/contracts";

// ── WebSocket registry ──────────────────────────────────────────────────────
const wsConnections = new Map<number, Set<WebSocket>>();
const wsTokens = new Map<string, { userId: number; expires: number }>();

setInterval(() => {
  const now = Date.now();
  Array.from(wsTokens.entries()).forEach(([token, data]) => {
    if (data.expires < now) wsTokens.delete(token);
  });
}, 30000);

function broadcastToUsers(userIds: number[], data: unknown) {
  const msg = JSON.stringify(data);
  for (const uid of userIds) {
    const conns = wsConnections.get(uid);
    if (!conns) continue;
    Array.from(conns).forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // ── WebSocket server ──────────────────────────────────────────────────────
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname !== "/ws") { socket.destroy(); return; }
    const token = url.searchParams.get("token");
    if (!token) { socket.destroy(); return; }
    const tokenData = wsTokens.get(token);
    if (!tokenData || tokenData.expires < Date.now()) { socket.destroy(); return; }
    wsTokens.delete(token);
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req, tokenData.userId);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: unknown, userId: number) => {
    if (!wsConnections.has(userId)) wsConnections.set(userId, new Set());
    wsConnections.get(userId)!.add(ws);
    ws.on("close", () => {
      wsConnections.get(userId)?.delete(ws);
      if (wsConnections.get(userId)?.size === 0) wsConnections.delete(userId);
    });
    ws.on("error", () => wsConnections.get(userId)?.delete(ws));
  });

  app.get("/api/ws-token", requireAuth, (req, res) => {
    const token = randomUUID();
    wsTokens.set(token, { userId: (req.user as User).id, expires: Date.now() + 30000 });
    res.json({ token });
  });

  // ── Swagger docs ──────────────────────────────────────────────────────────
  const swaggerDocument = yaml.load(path.join(process.cwd(), "server", "swagger.yaml"));
  app.use("/api/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // ── Seed ──────────────────────────────────────────────────────────────────
  await storage.seedMetadata();
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const hashedPassword = await crypto.hash("ChangeMe123!Now");
    await storage.createUser({
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      name: "Admin User",
      email: "admin@motio.local",
      password: hashedPassword,
      roleId: 1,
      phone: "12345678",
      isActive: true,
      mustChangePassword: true,
    });
    console.log("--- SEED ADMIN CREATED ---");
    console.log("Username: admin");
    console.log("Password: ChangeMe123!Now  (change immediately)");
    console.log("--------------------------");
  }

  // ── Metadata ─────────────────────────────────────────────────────────────
  app.get(api.metadata.statuses.path, requireAuth, async (_req, res) => res.json(await storage.getVehicleStatuses()));
  app.get(api.metadata.locations.path, requireAuth, async (_req, res) => res.json(await storage.getLocations()));
  app.get(api.metadata.roles.path, requireAuth, async (_req, res) => res.json(await storage.getRoles()));
  app.get(api.metadata.users.path, requireAuth, async (_req, res) => res.json(await storage.getAllUsers()));

  // ── Photo delete (standalone, not under vehicles) ─────────────────────────
  app.delete("/api/photos/:id", requireRole(ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.INNKJOPER), async (req, res) => {
    const photoId = Number(req.params.id);
    const rows = await db.select().from(photosTable).where(eq(photosTable.id, photoId));
    if (rows.length === 0) return res.sendStatus(404);
    if (rows[0].url) {
      // Resolve and verify the file stays inside uploads/ before deleting
      const uploadsRoot = path.resolve(process.cwd(), "uploads");
      const filePath = path.resolve(process.cwd(), rows[0].url.replace(/^\//, ""));
      if (filePath.startsWith(uploadsRoot + path.sep) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await storage.deletePhoto(photoId);
    res.json({ ok: true });
  });

  // Embed widget + public API (no auth, open CORS) — must come before Vite catch-all
  app.use(embedRouter);

  app.use("/api/showroom", showroomRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/vehicles", vehiclesRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/sales", salesRouter);
  app.get("/api/leaderboard/intake", requireAuth, async (req, res) => {
    const { z } = await import("zod");
    const { days } = z.object({ days: z.coerce.number().optional() }).parse(req.query);
    res.json(await storage.getIntakeCounts({ days }));
  });
  app.use("/api/conversations", createChatRouter(broadcastToUsers));
  app.use("/api/contract-templates", contractTemplatesRouter);
  app.use("/api/contracts", contractsRouter);

  return httpServer;
}
