import { Router } from "express"; // 1. Drop the IRouter import completely
import healthRouter from "./health.js";
import entriesRouter from "./entries.js";
import notesRouter from "./notes.js";
import pinRouter from "./pin.js";

// 2. Let TypeScript implicitly infer the perfect Router instance type
const router = Router(); 

router.use(healthRouter);
router.use(entriesRouter);
router.use(notesRouter);
router.use(pinRouter);

export default router;
