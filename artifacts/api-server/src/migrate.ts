import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    logger.info("Migrations applied");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  } finally {
    client.release();
  }
}
