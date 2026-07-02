import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
// 1. Import the parameter types along with RequestHandler
import type { Request, Response, NextFunction, RequestHandler } from "express"; 
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

app.use((_req: any, _res: any, next: (err?: any) => void) => {
  ensureMigrations()
    .then(() => next())
    .catch((err) => next(err));
});
app.use("/api", router);

// Catches errors passed to next(err) (e.g. a failed ensureMigrations() call
// on cold start) that would otherwise fall through to Express's default HTML
// error page. Logs the real error server-side and always responds with JSON
// so API clients never have to parse an HTML error body.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  (req as any).log?.error({ err }, "Unhandled error") ?? logger.error({ err }, "Unhandled error");
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
