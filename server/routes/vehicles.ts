import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { photos as photosTable, insertVehicleSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, validateUploadedImage } from "../middleware";
import { ROLE_NAMES, type User, type Role } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

type UserWithRole = User & { role: Role | null };
const { ADMIN, HYBRID, INNKJOPER, KLARGJORER } = ROLE_NAMES;

const vehiclePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(process.cwd(), "uploads", "vehicles", String(req.params.id));
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

const vehicleQuerySchema = z.object({
  statusId: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
}).optional();

export const vehiclesRouter = Router();

vehiclesRouter.get("/suggestions", requireAuth, async (req, res) => {
  const { q } = z.object({ q: z.string() }).parse(req.query);
  res.json(await storage.getVehicleSuggestions(q));
});

vehiclesRouter.get("/", requireAuth, async (req, res) => {
  const query = vehicleQuerySchema.parse(req.query);
  const page = Math.max(1, query?.page || 1);
  // Server-enforced cap — clients cannot request unbounded pages
  const limit = Math.min(Math.max(1, query?.limit || 10), 100);
  const result = await storage.getVehicles({ statusId: query?.statusId, q: query?.q, page, limit });
  res.json({ ...result, page, limit });
});

vehiclesRouter.get("/:id", requireAuth, async (req, res) => {
  const vehicle = await storage.getVehicle(Number(req.params.id));
  if (!vehicle) return res.sendStatus(404);
  const tasks = await storage.getTasks({ vehicleId: vehicle.id });
  res.json({ ...vehicle, tasks });
});

vehiclesRouter.post("/", requireRole(ADMIN, HYBRID, INNKJOPER), async (req, res) => {
  const input = insertVehicleSchema.parse(req.body);
  const vehicle = await storage.createVehicle({ ...input, addedById: input.addedById ?? (req.user as User).id });

  await storage.createAuditLog({
    userId: (req.user as User).id,
    action: "vehicle_created",
    entity: "vehicle",
    entityId: vehicle.id,
    newValue: JSON.stringify({ make: vehicle.make, model: vehicle.model, regNo: vehicle.regNo }),
  });

  res.status(201).json(vehicle);
});

vehiclesRouter.put("/:id", requireRole(ADMIN, HYBRID, INNKJOPER, KLARGJORER), async (req, res) => {
  const input = insertVehicleSchema.partial().parse(req.body);
  const vehicleId = Number(req.params.id);
  const user = req.user as UserWithRole;

  const oldVehicle = await storage.getVehicle(vehicleId);
  if (!oldVehicle) return res.sendStatus(404);

  if (user.role?.name === KLARGJORER) {
    if (Object.keys(input).some(k => k !== "statusId")) {
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
    if (newStatus?.name === "Klargjøring") {
      await storage.createTask({
        title: `Klargjøring: ${oldVehicle.make} ${oldVehicle.model} (${oldVehicle.regNo || oldVehicle.year})`,
        type: "Maintenance",
        priority: "Medium",
        status: "Open",
        vehicleId,
        regNo: oldVehicle.regNo || null,
        createdById: user.id,
        assigneeId: null,
        dueAt: null,
      });
    }
  }

  await storage.createAuditLog({
    userId: user.id,
    action: "vehicle_updated",
    entity: "vehicle",
    entityId: vehicleId,
    oldValue: JSON.stringify({ statusId: oldVehicle.statusId }),
    newValue: JSON.stringify(input),
  });

  res.json(vehicle);
});

vehiclesRouter.put("/:id/intaker", requireRole(ADMIN, HYBRID), async (req, res) => {
  const id = Number(req.params.id);
  const { addedById } = z.object({ addedById: z.number() }).parse(req.body);
  res.json(await storage.updateVehicle(id, { addedById }));
});

// Photos
vehiclesRouter.get("/:id/photos", requireAuth, async (req, res) => {
  res.json(await storage.getVehiclePhotos(Number(req.params.id)));
});

vehiclesRouter.post("/:id/photos", requireAuth, vehiclePhotoUpload.single("photo"), validateUploadedImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const vehicleId = Number(req.params.id);
  const url = `/uploads/vehicles/${vehicleId}/${req.file.filename}`;
  res.status(201).json(await storage.addVehiclePhoto(vehicleId, url, req.body.tag));
});

// Finn.no integration
vehiclesRouter.post("/:id/finn/publish", requireRole(ADMIN, HYBRID), async (req, res) => {
  const vehicleId = Number(req.params.id);
  const vehicle = await storage.getVehicle(vehicleId);
  if (!vehicle) return res.sendStatus(404);

  const apiKey = process.env.FINN_API_KEY;
  const partnerId = process.env.FINN_PARTNER_ID;
  if (!apiKey || !partnerId) {
    return res.status(400).json({ message: "FINN_API_KEY and FINN_PARTNER_ID must be configured" });
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
    return res.status(502).json({ message: "Finn.no did not return a FINNKODE.", detail: responseText.slice(0, 500) });
  } catch (err: any) {
    return res.status(502).json({ message: `Could not reach Finn.no: ${err.message}` });
  }
});

vehiclesRouter.delete("/:id/finn/publish", requireRole(ADMIN, HYBRID), async (req, res) => {
  const vehicleId = Number(req.params.id);
  const vehicle = await storage.getVehicle(vehicleId);
  if (!vehicle) return res.sendStatus(404);

  const apiKey = process.env.FINN_API_KEY;
  const partnerId = process.env.FINN_PARTNER_ID;
  if (!apiKey || !partnerId) {
    return res.status(400).json({ message: "FINN_API_KEY and FINN_PARTNER_ID must be configured" });
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
