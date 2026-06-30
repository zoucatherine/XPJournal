import { Router } from "express"; // 1. Dropped IRouter import
import { HealthCheckResponse } from "@workspace/api-zod";

// 2. Removed the : IRouter type restriction
const router = Router(); 

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
