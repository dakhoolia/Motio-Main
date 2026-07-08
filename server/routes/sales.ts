import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSaleSchema } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware";
import { ROLE_NAMES, type User } from "@shared/schema";

const { ADMIN, HYBRID, SELGER } = ROLE_NAMES;

export const salesRouter = Router();

salesRouter.get("/", requireAuth, async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().optional() }).parse(req.query);
  res.json(await storage.getSales({ days }));
});

salesRouter.post("/", requireRole(ADMIN, HYBRID, SELGER), async (req, res) => {
  const input = insertSaleSchema.parse({
    ...req.body,
    sellerId: req.body.sellerId || (req.user as User).id,
  });
  const sale = await storage.createSale(input);
  await storage.updateVehicle(input.vehicleId, { statusId: 6 });

  await storage.createAuditLog({
    userId: (req.user as User).id,
    action: "sale_created",
    entity: "sale",
    entityId: sale.id,
    newValue: JSON.stringify({ vehicleId: input.vehicleId, salePrice: input.salePrice, buyerName: input.buyerName }),
  });

  res.status(201).json(sale);
});

salesRouter.put("/:id", requireRole(ADMIN, HYBRID), async (req, res) => {
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
    action: "sale_updated",
    entity: "sale",
    entityId: id,
    newValue: JSON.stringify(updates),
  });

  res.json(sale);
});
