import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "../middleware";
import { encryptField, decryptField } from "../crypto";
import { ROLE_NAMES, type User, type Role } from "@shared/schema";

type UserWithRole = User & { role: Role | null };
const { ADMIN, HYBRID } = ROLE_NAMES;

// Person numbers (fødselsnummer) are sensitive PII — encrypted at rest
const ENCRYPTED_FIELDS = ["buyerPersonNumber", "sellerPersonNumber"] as const;

function encryptContractFields<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = { ...obj };
  for (const field of ENCRYPTED_FIELDS) {
    if (typeof out[field] === "string" && out[field]) out[field] = encryptField(out[field]);
  }
  return out as T;
}

function decryptContractFields<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = { ...obj };
  for (const field of ENCRYPTED_FIELDS) {
    if (typeof out[field] === "string" && out[field]) out[field] = decryptField(out[field]);
  }
  return out as T;
}

const contractBodySchema = z.object({
  type: z.enum(["innkjøp", "salg"]).optional(),
  templateId: z.number().optional().nullable(),
  vehicleId: z.number().optional().nullable(),
  status: z.enum(["draft", "pending", "signed", "cancelled"]).optional(),
  contactPerson: z.string().optional().nullable(),
  handoverDate: z.string().optional().nullable(),
  contractLocation: z.string().optional().nullable(),
  buyerName: z.string().optional().nullable(),
  buyerEmail: z.string().optional().nullable(),
  buyerPhone: z.string().optional().nullable(),
  buyerAddress: z.string().optional().nullable(),
  buyerPostalCode: z.string().optional().nullable(),
  buyerCity: z.string().optional().nullable(),
  buyerPersonNumber: z.string().optional().nullable(),
  sellerName: z.string().optional().nullable(),
  sellerEmail: z.string().optional().nullable(),
  sellerPhone: z.string().optional().nullable(),
  sellerAddress: z.string().optional().nullable(),
  sellerPostalCode: z.string().optional().nullable(),
  sellerCity: z.string().optional().nullable(),
  sellerPersonNumber: z.string().optional().nullable(),
  sellerAccountNo: z.string().optional().nullable(),
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
  settlementAmount: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customTerms: z.string().optional().nullable(),
});

// ── Contract Templates ────────────────────────────────────────────────────
export const contractTemplatesRouter = Router();

contractTemplatesRouter.get("/", requireAuth, async (_req, res) => {
  res.json(await storage.getContractTemplates());
});

contractTemplatesRouter.post("/", requireRole(ADMIN), async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    type: z.enum(["innkjøp", "salg"]),
    content: z.string(),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  res.json(await storage.createContractTemplate({ ...body, createdBy: (req.user as User).id }));
});

contractTemplatesRouter.put("/:id", requireRole(ADMIN), async (req, res) => {
  const body = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(["innkjøp", "salg"]).optional(),
    content: z.string().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  res.json(await storage.updateContractTemplate(Number(req.params.id), body));
});

contractTemplatesRouter.delete("/:id", requireRole(ADMIN), async (req, res) => {
  await storage.deleteContractTemplate(Number(req.params.id));
  res.json({ ok: true });
});

// ── Contracts ─────────────────────────────────────────────────────────────
export const contractsRouter = Router();

// Contracts
contractsRouter.get("/", requireAuth, async (req, res) => {
  const user = req.user as UserWithRole;
  const { type, status } = req.query as Record<string, string>;
  const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
  const list = await storage.getContracts({
    type: type || undefined,
    status: status || undefined,
    createdBy: isAdminOrHybrid ? undefined : user.id,
  });
  res.json(list.map(decryptContractFields));
});

contractsRouter.post("/", requireAuth, async (req, res) => {
  const body = encryptContractFields(contractBodySchema.parse(req.body));
  const contract = await storage.createContract({ ...body, createdBy: (req.user as User).id, status: "draft" } as any);
  res.json(decryptContractFields(contract));
});

contractsRouter.get("/:id", requireAuth, async (req, res) => {
  const user = req.user as UserWithRole;
  const contract = await storage.getContract(Number(req.params.id));
  if (!contract) return res.sendStatus(404);
  const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
  if (!isAdminOrHybrid && contract.createdBy !== user.id) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  res.json(decryptContractFields(contract));
});

contractsRouter.put("/:id", requireAuth, async (req, res) => {
  const user = req.user as UserWithRole;
  const id = Number(req.params.id);
  const existing = await storage.getContract(id);
  if (!existing) return res.sendStatus(404);
  const isAdminOrHybrid = user.role?.name === ADMIN || user.role?.name === HYBRID;
  if (!isAdminOrHybrid && existing.createdBy !== user.id) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const updated = await storage.updateContract(id, encryptContractFields(contractBodySchema.parse(req.body)));
  res.json(decryptContractFields(updated));
});

contractsRouter.delete("/:id", requireAuth, async (req, res) => {
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

contractsRouter.post("/:id/send", requireAuth, async (req, res) => {
  const existing = await storage.getContract(Number(req.params.id));
  if (!existing) return res.sendStatus(404);
  const updated = await storage.updateContract(Number(req.params.id), { status: "pending" });
  res.json(decryptContractFields(updated));
});

contractsRouter.post("/:id/sign", requireAuth, async (req, res) => {
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
  // Simulated signing — no real BankID verification is performed.
  // The SIM- prefix makes clear this is not a BankID transaction reference.
  const bankIdRef = `SIM-${Date.now()}-${party.toUpperCase()}`;
  const signed = await storage.signContract(id, party, bankIdRef);
  res.json(decryptContractFields(signed));
});
