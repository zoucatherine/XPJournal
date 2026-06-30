import { Router } from "express";
// 1. Explicitly import Request and Response type structures
import type { Request, Response } from "express"; 
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

// 2. Explicitly type _req and res inline to satisfy strict mode
router.get("/healthz", (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
