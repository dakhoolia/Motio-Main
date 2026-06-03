import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { photos as photosTable } from "@shared/schema";
import { eq } from "drizzle-orm";
import { api } from "@shared/routes";
import { z } from "zod";
import { crypto } from "./crypto";
import { ROLE_NAMES, type User, type Role } from "@shared/schema";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";
import path from "path";
import multer from "multer";
import fs from "fs";
import express from "express";

// ── WebSocket registry ────────────────────────────────────────────────────────
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

type UserWithRole = User & { role: Role | null };

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  next();
}

function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as UserWithRole;
    if (!user.role || !allowedRoles.includes(user.role.name)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

const { ADMIN, HYBRID, INNKJOPER, SELGER, KLARGJORER } = ROLE_NAMES;

// ── Multer avatar upload ──────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, _file, cb) => {
    const userId = (req.user as User).id;
    cb(null, `avatar-${userId}-${Date.now()}.jpg`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Multer vehicle photo upload ───────────────────────────────────────────────
const vehiclePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(process.cwd(), "uploads", "vehicles", req.params.id);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, `photo-${Date.now()}.jpg`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Serve uploaded avatars as static files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // ── WebSocket server ────────────────────────────────────────────────────────
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
    ws.on("error", () => {
      wsConnections.get(userId)?.delete(ws);
    });
  });

  // WS token endpoint
  app.get("/api/ws-token", requireAuth, (req, res) => {
    const token = randomUUID();
    wsTokens.set(token, { userId: (req.user as User).id, expires: Date.now() + 30000 });
    res.json({ token });
  });

  const swaggerDocument = yaml.load(path.join(process.cwd(), "server", "swagger.yaml"));
  app.use("/api/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  await storage.seedMetadata();

  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const password = "admin";
    const hashedPassword = await crypto.hash(password);
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
      mustChangePassword: false,
    });
    console.log("--- SEED ADMIN CREATED ---");
    console.log("Email: admin@motio.local");
    console.log("Password: admin");
    console.log("--------------------------");
  }

  // === Metadata ===
  app.get(api.metadata.statuses.path, requireAuth, async (req, res) => {
    const statuses = await storage.getVehicleStatuses();
    res.json(statuses);
  });

  app.get(api.metadata.locations.path, requireAuth, async (req, res) => {
    const locations = await storage.getLocations();
    res.json(locations);
  });

  app.get(api.metadata.roles.path, requireAuth, async (req, res) => {
    const roles = await storage.getRoles();
    res.json(roles);
  });

  app.get(api.metadata.users.path, requireAuth, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // === Admin User Management ===
  app.post('/api/users', requireRole(ADMIN), async (req, res) => {
    try {
      const input = z.object({
        username: z.string().min(2),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        roleId: z.number(),
        password: z.string().min(4),
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
        action: 'user_created',
        entity: 'user',
        entityId: user.id,
        newValue: JSON.stringify({ username: user.username, email: user.email, roleId: user.roleId }),
      });

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(400).json({ message: "Username or email already exists" });
      }
      throw err;
    }
  });

  app.put('/api/users/:id', requireRole(ADMIN), async (req, res) => {
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

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: 'user_updated',
      entity: 'user',
      entityId: id,
      oldValue: JSON.stringify({ email: oldUser.email, roleId: oldUser.roleId, isActive: oldUser.isActive }),
      newValue: JSON.stringify(updates),
    });

    res.json(user);
  });

  app.put('/api/users/:id/reset-password', requireRole(ADMIN), async (req, res) => {
    const id = Number(req.params.id);
    const { newPassword } = z.object({ newPassword: z.string().min(4) }).parse(req.body);

    const user = await storage.getUser(id);
    if (!user) return res.sendStatus(404);

    const hashedPassword = await crypto.hash(newPassword);
    await storage.updateUser(id, { 
      password: hashedPassword, 
      mustChangePassword: true 
    });

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: 'password_reset',
      entity: 'user',
      entityId: id,
    });

    res.json({ message: "Password reset successfully" });
  });

  // === Showroom (public, no auth) ===
  app.get("/api/showroom", async (_req, res) => {
    const vehicles = await storage.getPublicVehicles();
    res.json(vehicles);
  });

  app.get("/api/showroom/:id", async (req, res) => {
    const vehicle = await storage.getPublicVehicle(Number(req.params.id));
    if (!vehicle) return res.sendStatus(404);
    res.json(vehicle);
  });

  // === Vehicles ===
  app.get(api.vehicles.list.path, requireAuth, async (req, res) => {
    const query = api.vehicles.list.input.optional().parse(req.query);
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const result = await storage.getVehicles({
      statusId: query?.statusId,
      q: query?.q,
      page,
      limit
    });
    res.json({ ...result, page, limit });
  });

  app.get(api.vehicles.get.path, requireAuth, async (req, res) => {
    const vehicle = await storage.getVehicle(Number(req.params.id));
    if (!vehicle) return res.sendStatus(404);
    
    const tasks = await storage.getTasks({ vehicleId: vehicle.id });
    res.json({ ...vehicle, tasks });
  });

  app.post(api.vehicles.create.path, requireRole(ADMIN, HYBRID, INNKJOPER), async (req, res) => {
    const input = api.vehicles.create.input.parse(req.body);
    const vehicle = await storage.createVehicle({ ...input, addedById: input.addedById ?? (req.user as User).id });

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: 'vehicle_created',
      entity: 'vehicle',
      entityId: vehicle.id,
      newValue: JSON.stringify({ make: vehicle.make, model: vehicle.model, regNo: vehicle.regNo }),
    });

    res.status(201).json(vehicle);
  });

  app.put(api.vehicles.update.path, requireRole(ADMIN, HYBRID, INNKJOPER, KLARGJORER), async (req, res) => {
    const input = api.vehicles.update.input.parse(req.body);
    const vehicleId = Number(req.params.id);
    const user = req.user as UserWithRole;
    
    const oldVehicle = await storage.getVehicle(vehicleId);
    if (!oldVehicle) return res.sendStatus(404);

    if (user.role?.name === KLARGJORER) {
      const allowedFields = ['statusId'];
      const keys = Object.keys(input);
      if (keys.some(k => !allowedFields.includes(k))) {
        return res.status(403).json({ message: "Klargjører can only update vehicle status" });
      }
    }

    if (user.role?.name === INNKJOPER && oldVehicle.addedById !== user.id) {
      return res.status(403).json({ message: "You can only edit vehicles you added" });
    }

    const vehicle = await storage.updateVehicle(vehicleId, input);

    if (input.statusId && input.statusId !== oldVehicle.statusId) {
      const statuses = await storage.getVehicleStatuses();
      const newStatus = statuses.find(s => s.id === input.statusId);
      if (newStatus?.name === 'Klargjøring') {
        await storage.createTask({
          title: `Klargjøring: ${oldVehicle.make} ${oldVehicle.model} (${oldVehicle.regNo || oldVehicle.year})`,
          type: 'Maintenance',
          priority: 'Medium',
          status: 'Open',
          vehicleId: vehicleId,
          regNo: oldVehicle.regNo || null,
          createdById: user.id,
          assigneeId: null,
          dueAt: null,
        });
      }
    }

    await storage.createAuditLog({
      userId: user.id,
      action: 'vehicle_updated',
      entity: 'vehicle',
      entityId: vehicleId,
      oldValue: JSON.stringify({ statusId: oldVehicle.statusId }),
      newValue: JSON.stringify(input),
    });

    res.json(vehicle);
  });

  app.get(api.vehicles.suggestions.path, requireAuth, async (req, res) => {
    const query = api.vehicles.suggestions.input.parse(req.query);
    const suggestions = await storage.getVehicleSuggestions(query.q);
    res.json(suggestions);
  });

  // === Vehicle Photos ===
  app.get("/api/vehicles/:id/photos", requireAuth, async (req, res) => {
    const vehicleId = Number(req.params.id);
    const vehiclePhotos = await storage.getVehiclePhotos(vehicleId);
    res.json(vehiclePhotos);
  });

  app.post("/api/vehicles/:id/photos", requireAuth, vehiclePhotoUpload.single("photo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const vehicleId = Number(req.params.id);
    const url = `/uploads/vehicles/${vehicleId}/${req.file.filename}`;
    const photo = await storage.addVehiclePhoto(vehicleId, url, req.body.tag);
    res.status(201).json(photo);
  });

  app.delete("/api/photos/:id", requireAuth, async (req, res) => {
    const photoId = Number(req.params.id);
    const vehiclePhotos = await db.select().from(photosTable).where(eq(photosTable.id, photoId));
    if (vehiclePhotos.length > 0 && vehiclePhotos[0].url) {
      const filePath = path.join(process.cwd(), vehiclePhotos[0].url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await storage.deletePhoto(photoId);
    res.json({ ok: true });
  });

  // === Finn.no Integration ===
  app.post("/api/vehicles/:id/finn/publish", requireRole(ADMIN, HYBRID), async (req, res) => {
    const vehicleId = Number(req.params.id);
    const vehicle = await storage.getVehicle(vehicleId);
    if (!vehicle) return res.sendStatus(404);

    const apiKey = process.env.FINN_API_KEY;
    const partnerId = process.env.FINN_PARTNER_ID;
    if (!apiKey || !partnerId) {
      return res.status(400).json({ message: "FINN_API_KEY and FINN_PARTNER_ID must be configured in environment secrets" });
    }

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DOCUMENT SYSTEM "car-used-sale.dtd">
<DOCUMENT>
  <AD TYPE="car-used-sale">
    <PARTNER>${esc(partnerId)}</PARTNER>
    <ORDERNO>MOTIO-${vehicleId}</ORDERNO>
    <TITLE>${esc(`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? " " + vehicle.variant : ""}`)}</TITLE>
    ${vehicle.description ? `<DESCRIPTION>${esc(vehicle.description)}</DESCRIPTION>` : ""}
    ${vehicle.listPrice ? `<PRICE>${Math.round(Number(vehicle.listPrice))}</PRICE>` : ""}
    <REGISTRATION_YEAR>${vehicle.year}</REGISTRATION_YEAR>
    ${vehicle.mileage != null ? `<MILEAGE>${vehicle.mileage}</MILEAGE>` : ""}
    ${vehicle.fuelType ? `<FUEL_TYPE>${esc(vehicle.fuelType)}</FUEL_TYPE>` : ""}
    ${vehicle.transmission ? `<GEARBOX>${esc(vehicle.transmission)}</GEARBOX>` : ""}
    <MAKE>${esc(vehicle.make)}</MAKE>
    <MODEL>${esc(vehicle.model)}</MODEL>
    ${vehicle.bodyType ? `<BODY_TYPE>${esc(vehicle.bodyType)}</BODY_TYPE>` : ""}
    ${vehicle.color ? `<COLOR>${esc(vehicle.color)}</COLOR>` : ""}
    ${vehicle.location?.name ? `<COUNTY>${esc(vehicle.location.name)}</COUNTY>` : ""}
  </AD>
</DOCUMENT>`;

    try {
      const response = await fetch("https://upload.api.finn.no/iad/", {
        method: "POST",
        headers: { "Content-Type": "application/xml", "x-FINN-apikey": apiKey },
        body: xml,
      });
      const responseText = await response.text();
      const finnCodeMatch = responseText.match(/<FINNKODE>(\d+)<\/FINNKODE>/);
      const finnCode = finnCodeMatch ? finnCodeMatch[1] : null;
      if (finnCode) {
        await storage.updateVehicle(vehicleId, { finnCode, finnPublishedAt: new Date() } as any);
        return res.json({ finnCode });
      }
      return res.status(502).json({ message: "Finn.no did not return a FINNKODE. Check your credentials.", detail: responseText.slice(0, 500) });
    } catch (err: any) {
      return res.status(502).json({ message: `Could not reach Finn.no: ${err.message}` });
    }
  });

  app.delete("/api/vehicles/:id/finn/publish", requireRole(ADMIN, HYBRID), async (req, res) => {
    const vehicleId = Number(req.params.id);
    const vehicle = await storage.getVehicle(vehicleId);
    if (!vehicle) return res.sendStatus(404);

    const apiKey = process.env.FINN_API_KEY;
    const partnerId = process.env.FINN_PARTNER_ID;
    if (!apiKey || !partnerId) {
      return res.status(400).json({ message: "FINN_API_KEY and FINN_PARTNER_ID must be configured in environment secrets" });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DOCUMENT SYSTEM "iadif-stop.dtd">
<DOCUMENT>
  <STOP TYPE="car-used-sale">
    <PARTNER>${partnerId}</PARTNER>
    <ORDERNO>MOTIO-${vehicleId}</ORDERNO>
    <STATUS>REMOVED</STATUS>
  </STOP>
</DOCUMENT>`;

    try {
      await fetch("https://upload.api.finn.no/iad/", {
        method: "POST",
        headers: { "Content-Type": "application/xml", "x-FINN-apikey": apiKey },
        body: xml,
      });
      await storage.updateVehicle(vehicleId, { finnCode: null, finnPublishedAt: null } as any);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(502).json({ message: `Could not reach Finn.no: ${err.message}` });
    }
  });

  // === Tasks ===
  app.get(api.tasks.list.path, requireAuth, async (req, res) => {
    const query = api.tasks.list.input.optional().parse(req.query);
    const tasks = await storage.getTasks(query || {});
    res.json(tasks);
  });

  app.post(api.tasks.create.path, requireAuth, async (req, res) => {
    const input = api.tasks.create.input.parse({
      ...req.body,
      createdById: (req.user as User).id
    });
    const task = await storage.createTask(input);
    res.status(201).json(task);
  });

  app.put(api.tasks.update.path, requireAuth, async (req, res) => {
    const input = api.tasks.update.input.parse(req.body);
    const task = await storage.updateTask(Number(req.params.id), input);
    res.json(task);
  });

  // === Leaderboard ===
  app.get('/api/leaderboard/intake', requireAuth, async (req, res) => {
    const query = z.object({ days: z.coerce.number().optional() }).parse(req.query);
    const intakeCounts = await storage.getIntakeCounts({ days: query.days });
    res.json(intakeCounts);
  });

  // === Sales ===
  app.get(api.sales.list.path, requireAuth, async (req, res) => {
    const query = api.sales.list.input.optional().parse(req.query);
    const salesData = await storage.getSales({ days: query?.days });
    res.json(salesData);
  });

  app.post(api.sales.create.path, requireRole(ADMIN, HYBRID, SELGER), async (req, res) => {
    const input = api.sales.create.input.parse({
      ...req.body,
      sellerId: req.body.sellerId || (req.user as User).id
    });
    const sale = await storage.createSale(input);
    
    await storage.updateVehicle(input.vehicleId, { statusId: 6 });

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: 'sale_created',
      entity: 'sale',
      entityId: sale.id,
      newValue: JSON.stringify({ vehicleId: input.vehicleId, salePrice: input.salePrice, buyerName: input.buyerName }),
    });

    res.status(201).json(sale);
  });

  app.put('/api/sales/:id', requireRole(ADMIN, HYBRID), async (req, res) => {
    const id = Number(req.params.id);
    const updates = z.object({
      sellerId: z.number().optional(),
      buyerName: z.string().optional(),
      buyerPhone: z.string().optional(),
      salePrice: z.string().optional(),
      buyPrice: z.string().optional(),
      serviceCost: z.string().optional(),
    }).parse(req.body);
    const sale = await storage.updateSale(id, updates);

    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: 'sale_updated',
      entity: 'sale',
      entityId: id,
      newValue: JSON.stringify(updates),
    });

    res.json(sale);
  });

  app.put('/api/vehicles/:id/intaker', requireRole(ADMIN, HYBRID), async (req, res) => {
    const id = Number(req.params.id);
    const { addedById } = z.object({ addedById: z.number() }).parse(req.body);
    const vehicle = await storage.updateVehicle(id, { addedById });
    res.json(vehicle);
  });

  // ── Avatar upload ─────────────────────────────────────────────────────────

  app.post("/api/users/me/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const userId = (req.user as User).id;
    // Delete old avatar file if it exists
    const existing = await storage.getUser(userId);
    if (existing?.avatarUrl) {
      const oldPath = path.join(process.cwd(), existing.avatarUrl.replace(/^\//, ""));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await storage.updateUser(userId, { avatarUrl });
    res.json(updated);
  });

  app.delete("/api/users/me/avatar", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const existing = await storage.getUser(userId);
    if (existing?.avatarUrl) {
      const oldPath = path.join(process.cwd(), existing.avatarUrl.replace(/^\//, ""));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const updated = await storage.updateUser(userId, { avatarUrl: null });
    res.json(updated);
  });

  // ── Chat REST API ──────────────────────────────────────────────────────────

  app.get("/api/conversations", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convs = await storage.getConversations(userId);
    res.json(convs);
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const body = z.discriminatedUnion("type", [
      z.object({ type: z.literal("direct"), userId: z.number() }),
      z.object({ type: z.literal("group"), name: z.string().min(1), memberIds: z.array(z.number()) }),
    ]).parse(req.body);

    if (body.type === "direct") {
      const conv = await storage.getOrCreateDirectConversation(userId, body.userId);
      return res.json(conv);
    } else {
      const user = req.user as UserWithRole;
      if (!user.role || user.role.name !== ADMIN) {
        return res.status(403).json({ message: "Only admins can create group conversations" });
      }
      const conv = await storage.createGroupConversation(body.name, userId, body.memberIds);
      return res.json(conv);
    }
  });

  app.get("/api/conversations/:id", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const conv = await storage.getConversation(convId, userId);
    if (!conv) return res.status(404).json({ message: "Not found" });
    res.json(conv);
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const before = req.query.before ? Number(req.query.before) : undefined;
    const msgs = await storage.getMessages(convId, limit, before);
    res.json(msgs);
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const { content } = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);
    const msg = await storage.createMessage(convId, userId, content);
    // Broadcast to all conversation members
    const memberIds = await storage.getConversationMemberIds(convId);
    broadcastToUsers(memberIds, { type: "new_message", conversationId: convId, message: msg });
    res.json(msg);
  });

  app.post("/api/conversations/:id/read", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    await storage.markConversationRead(convId, userId);
    res.json({ ok: true });
  });

  // ── Contract Templates (Admin only) ──────────────────────────────────────

  app.get("/api/contract-templates", requireAuth, async (req, res) => {
    const templates = await storage.getContractTemplates();
    res.json(templates);
  });

  app.post("/api/contract-templates", requireRole(ADMIN), async (req, res) => {
    const body = z.object({
      name: z.string().min(1),
      type: z.enum(["innkjøp", "salg"]),
      content: z.string(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const template = await storage.createContractTemplate({
      ...body,
      createdBy: (req.user as User).id,
    });
    res.json(template);
  });

  app.put("/api/contract-templates/:id", requireRole(ADMIN), async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(["innkjøp", "salg"]).optional(),
      content: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const template = await storage.updateContractTemplate(id, body);
    res.json(template);
  });

  app.delete("/api/contract-templates/:id", requireRole(ADMIN), async (req, res) => {
    await storage.deleteContractTemplate(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Contracts ─────────────────────────────────────────────────────────────

  app.get("/api/contracts", requireAuth, async (req, res) => {
    const user = req.user as UserWithRole;
    const { type, status } = req.query as Record<string, string>;
    const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
    const list = await storage.getContracts({
      type: type || undefined,
      status: status || undefined,
      createdBy: isAdminOrHybrid ? undefined : user.id,
    });
    res.json(list);
  });

  app.post("/api/contracts", requireAuth, async (req, res) => {
    const user = req.user as User;
    const body = z.object({
      templateId: z.number().optional().nullable(),
      vehicleId: z.number().optional().nullable(),
      type: z.enum(["innkjøp", "salg"]),
      buyerName: z.string().optional().nullable(),
      buyerEmail: z.string().optional().nullable(),
      buyerPhone: z.string().optional().nullable(),
      buyerAddress: z.string().optional().nullable(),
      buyerPersonNumber: z.string().optional().nullable(),
      sellerName: z.string().optional().nullable(),
      sellerEmail: z.string().optional().nullable(),
      sellerPhone: z.string().optional().nullable(),
      sellerAddress: z.string().optional().nullable(),
      sellerPersonNumber: z.string().optional().nullable(),
      vehicleMake: z.string().optional().nullable(),
      vehicleModel: z.string().optional().nullable(),
      vehicleYear: z.number().optional().nullable(),
      vehicleVin: z.string().optional().nullable(),
      vehicleMileage: z.number().optional().nullable(),
      vehicleColor: z.string().optional().nullable(),
      vehicleRegNo: z.string().optional().nullable(),
      vehicleEquipment: z.string().optional().nullable(),
      vehicleTires: z.string().optional().nullable(),
      vehiclePrice: z.string().optional().nullable(),
      vehicleFuelType: z.string().optional().nullable(),
      vehicleTransmission: z.string().optional().nullable(),
      vehicleBodyType: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const contract = await storage.createContract({ ...body, createdBy: user.id, status: "draft" });
    res.json(contract);
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) return res.sendStatus(404);
    res.json(contract);
  });

  app.put("/api/contracts/:id", requireAuth, async (req, res) => {
    const user = req.user as UserWithRole;
    const id = Number(req.params.id);
    const existing = await storage.getContract(id);
    if (!existing) return res.sendStatus(404);
    const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
    if (!isAdminOrHybrid && existing.createdBy !== user.id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const body = z.object({
      templateId: z.number().optional().nullable(),
      vehicleId: z.number().optional().nullable(),
      status: z.enum(["draft", "pending", "signed", "cancelled"]).optional(),
      // Header
      contactPerson: z.string().optional().nullable(),
      handoverDate: z.string().optional().nullable(),
      contractLocation: z.string().optional().nullable(),
      // Buyer
      buyerName: z.string().optional().nullable(),
      buyerEmail: z.string().optional().nullable(),
      buyerPhone: z.string().optional().nullable(),
      buyerAddress: z.string().optional().nullable(),
      buyerPostalCode: z.string().optional().nullable(),
      buyerCity: z.string().optional().nullable(),
      buyerPersonNumber: z.string().optional().nullable(),
      // Seller
      sellerName: z.string().optional().nullable(),
      sellerEmail: z.string().optional().nullable(),
      sellerPhone: z.string().optional().nullable(),
      sellerAddress: z.string().optional().nullable(),
      sellerPostalCode: z.string().optional().nullable(),
      sellerCity: z.string().optional().nullable(),
      sellerPersonNumber: z.string().optional().nullable(),
      sellerAccountNo: z.string().optional().nullable(),
      // Vehicle
      vehicleMake: z.string().optional().nullable(),
      vehicleModel: z.string().optional().nullable(),
      vehicleYear: z.number().optional().nullable(),
      vehicleVin: z.string().optional().nullable(),
      vehicleMileage: z.number().optional().nullable(),
      vehicleColor: z.string().optional().nullable(),
      vehicleRegNo: z.string().optional().nullable(),
      vehicleEquipment: z.string().optional().nullable(),
      vehicleTires: z.string().optional().nullable(),
      vehiclePrice: z.string().optional().nullable(),
      vehicleFuelType: z.string().optional().nullable(),
      vehicleTransmission: z.string().optional().nullable(),
      vehicleBodyType: z.string().optional().nullable(),
      vehicleFirstRegistered: z.string().optional().nullable(),
      vehicleKeys: z.number().optional().nullable(),
      vehicleEuControlLast: z.string().optional().nullable(),
      vehicleEuControlNext: z.string().optional().nullable(),
      // Settlement
      settlementAmount: z.string().optional().nullable(),
      // Notes
      notes: z.string().optional().nullable(),
      customTerms: z.string().optional().nullable(),
    }).parse(req.body);
    const updated = await storage.updateContract(id, body);
    res.json(updated);
  });

  app.delete("/api/contracts/:id", requireAuth, async (req, res) => {
    const user = req.user as UserWithRole;
    const id = Number(req.params.id);
    const existing = await storage.getContract(id);
    if (!existing) return res.sendStatus(404);
    const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
    if (!isAdminOrHybrid && existing.createdBy !== user.id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    await storage.deleteContract(id);
    res.json({ ok: true });
  });

  app.post("/api/contracts/:id/send", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getContract(id);
    if (!existing) return res.sendStatus(404);
    const updated = await storage.updateContract(id, { status: "pending" });
    res.json(updated);
  });

  app.post("/api/contracts/:id/sign", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { party, phoneNumber } = z.object({
      party: z.enum(["buyer", "seller"]),
      phoneNumber: z.string().min(8),
    }).parse(req.body);
    const existing = await storage.getContract(id);
    if (!existing) return res.sendStatus(404);
    if (existing.status !== "pending") {
      return res.status(400).json({ message: "Kontrakten må være sendt til signering først" });
    }
    // Simulate BankID verification with a unique reference
    const bankIdRef = `BANKID-${Date.now()}-${party.toUpperCase()}`;
    const updated = await storage.signContract(id, party, bankIdRef);
    res.json(updated);
  });

  app.post("/api/conversations/:id/members", requireRole(ADMIN), async (req, res) => {
    const convId = Number(req.params.id);
    const { userId } = z.object({ userId: z.number() }).parse(req.body);
    await storage.addConversationMember(convId, userId);
    res.json({ ok: true });
  });

  app.delete("/api/conversations/:id/members/:userId", requireRole(ADMIN), async (req, res) => {
    const convId = Number(req.params.id);
    const uid = Number(req.params.userId);
    await storage.removeConversationMember(convId, uid);
    res.json({ ok: true });
  });

  return httpServer;
}
