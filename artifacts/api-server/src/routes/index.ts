import { Router } from "express"; // 1. Drop the IRouter import completely
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import entriesRouter from "./entries.js";
import notesRouter from "./notes.js";
import pinRouter from "./pin.js";
import attachmentsRouter from "./attachments.js";
import stickersRouter from "./stickers.js";
import { maybeCleanupStickers } from "../lib/desktopStickers.js";
import { maybeCleanupAttachments } from "../lib/attachments.js";
import { requireAuth } from "../middleware/auth.js";

// 2. Let TypeScript implicitly infer the perfect Router instance type
const router = Router(); 

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(async (_req, _res, next) => { await maybeCleanupAttachments(); next(); });
router.use(async (_req, _res, next) => { await maybeCleanupStickers(); next(); });
router.use(stickersRouter);
router.use(attachmentsRouter);
router.use(entriesRouter);
router.use(notesRouter);
router.use(pinRouter);

export default router;
