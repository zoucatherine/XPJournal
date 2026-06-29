import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import notesRouter from "./notes";
import pinRouter from "./pin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(notesRouter);
router.use(pinRouter);

export default router;
