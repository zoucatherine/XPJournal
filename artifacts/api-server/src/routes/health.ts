import { Router } from "express";
// 1. Remove Response and Request imports completely to clear up the namespace
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

// 2. Drop the explicit variable types so Express naturally provides its own methods
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data); 
});

export default router;
