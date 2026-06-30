import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
// 1. Import RequestHandler cleanly as a type
import type { RequestHandler } from "express"; 
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./migrate.js";

const app = express();

let migrationsDone = false;
let migrationPromise: Promise<void> | null = null;

async function ensureMigrations(): Promise<void> {
  if (migrationsDone) return;
  if (!migrationPromise) {
    migrationPromise = runMigrations()
      .then(() => {
        migrationsDone = true;
      })
      .catch((err) => {
        migrationPromise = null;
        throw err;
      });
  }
  return migrationPromise;
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage) {
        return {
          id: (req as IncomingMessage & { id: unknown }).id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const migrationMiddleware: RequestHandler = (_req, _res, next) => {
  ensureMigrations()
    .then(() => next())
    .catch((err) => next(err));
};
app.use(migrationMiddleware);
app.use("/api", router);

export default app;
