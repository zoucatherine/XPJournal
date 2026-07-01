import { Router } from "express";
<<<<<<< HEAD
// 1. Explicitly import Request and Response type structures directly from express
import type { Request, Response } from "express";
=======
>>>>>>> f974e8a (Fix TypeScript errors in health.ts route)
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

<<<<<<< HEAD
// 2. Add explicit inline types to satisfy noImplicitAny
router.get("/healthz", (_req: Request, res: Response) => {
=======
router.get("/healthz", (_req, res) => {
>>>>>>> f974e8a (Fix TypeScript errors in health.ts route)
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
