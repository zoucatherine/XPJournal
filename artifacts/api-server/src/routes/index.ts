import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(notesRouter);

export default router;
