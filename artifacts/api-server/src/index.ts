import app from "./app";
import { logger } from "./lib/logger";
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
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  });
}

export default app;
