import { Router } from "express";
import { storage } from "../storage";

export const showroomRouter = Router();

showroomRouter.get("/", async (_req, res) => {
  const vehicles = await storage.getPublicVehicles();
  res.json(vehicles);
});

showroomRouter.get("/:id", async (req, res) => {
  const vehicle = await storage.getPublicVehicle(Number(req.params.id));
  if (!vehicle) return res.sendStatus(404);
  res.json(vehicle);
});
