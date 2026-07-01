import { Router } from "express";
// 1. Explicitly import Request and Response type structures directly from express
import type { Request, Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

// 2. Add explicit inline types to satisfy noImplicitAny
router.get("/healthz", (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
