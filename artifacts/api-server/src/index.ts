import app from "./app.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./migrate.js";

const migrationPromise = runMigrations().catch((err) => {
  logger.error({ err }, "Failed to run migrations");
  process.exit(1);
});

if (process.env.VERCEL !== "1") {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  migrationPromise.then(() => {
    const server = app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
    server.on("error", (err: Error) => {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    });
  });
}

export default app;
