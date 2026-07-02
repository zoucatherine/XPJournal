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

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Add nullable user_id columns to legacy tables. These are tightened to
    // NOT NULL (and folded into composite primary keys) once the first
    // account is created and legacy rows are backfilled — see
    // backfillFirstUser() below, invoked from the signup route.
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);

    logger.info("Migrations applied");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs exactly once, immediately after the very first user account is
 * created. Assigns any pre-existing (pre-auth) journal entries, sticky
 * notes, and PIN settings to that account, then tightens the schema so
 * user_id is required and forms part of the primary key going forward.
 *
 * Must be called from inside the same transaction that verified this is
 * the first user (see routes/auth.ts).
 */
export async function backfillFirstUser(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  firstUserId: string,
): Promise<void> {
  await client.query(`UPDATE journal_entries SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);
  await client.query(`UPDATE sticky_notes SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);
  await client.query(`UPDATE settings SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);

  await client.query(`ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL`);
  await client.query(`ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_pkey`);
  await client.query(`ALTER TABLE journal_entries ADD PRIMARY KEY (user_id, date)`);

  await client.query(`ALTER TABLE sticky_notes ALTER COLUMN user_id SET NOT NULL`);

  await client.query(`ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL`);
  await client.query(`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`);
  await client.query(`ALTER TABLE settings ADD PRIMARY KEY (user_id, key)`);
}
