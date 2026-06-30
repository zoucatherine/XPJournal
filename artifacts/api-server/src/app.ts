import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
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

app.use((_req: Request, _res: Response, next: NextFunction) => {
  ensureMigrations().then(() => next()).catch(next);
});

app.use("/api", router);

export default app;
