import { Router } from "express";
import { storage } from "../storage";
import { insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";
import type { User } from "@shared/schema";

export const tasksRouter = Router();

const taskQuerySchema = z.object({
  vehicleId: z.coerce.number().optional(),
  assigneeId: z.coerce.number().optional(),
  status: z.string().optional(),
}).optional();

tasksRouter.get("/", requireAuth, async (req, res) => {
  const query = taskQuerySchema.parse(req.query);
  res.json(await storage.getTasks(query || {}));
});

tasksRouter.post("/", requireAuth, async (req, res) => {
  const input = insertTaskSchema.parse({ ...req.body, createdById: (req.user as User).id });
  res.status(201).json(await storage.createTask(input));
});

tasksRouter.put("/:id", requireAuth, async (req, res) => {
  const input = insertTaskSchema.partial().parse(req.body);
  res.json(await storage.updateTask(Number(req.params.id), input));
});
