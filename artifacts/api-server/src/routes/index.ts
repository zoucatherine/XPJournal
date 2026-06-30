import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import entriesRouter from "./entries.js";
import notesRouter from "./notes.js";
import pinRouter from "./pin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(notesRouter);
router.use(pinRouter);

export default router;
