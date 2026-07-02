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

    // Tracks one-time, non-repeatable migration steps (e.g. the legacy-table
    // backfill below) so they can be recorded as "already done" instead of
    // being re-triggered by inferring state from other tables (which can
    // regress — e.g. if the only user row is later deleted).
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
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

type QueryClient = { query: (sql: string, params?: unknown[]) => Promise<any> };

const FIRST_USER_BACKFILL_MIGRATION = "first_user_backfill";

/**
 * Ensures `table`'s primary key is exactly `columns`. No-ops if it already
 * is, so this is safe to call even on environments that already hit the
 * "first user backfill ran twice" bug and are left in a partially-migrated
 * state (e.g. PK already changed but marker missing, or vice versa).
 */
async function ensureCompositePrimaryKey(
  client: QueryClient,
  table: string,
  columns: string[],
): Promise<void> {
  const result = await client.query(
    `SELECT a.attname AS column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [table],
  );
  const current = (result.rows as { column_name: string }[]).map((r) => r.column_name).sort();
  const target = [...columns].sort();
  const alreadyCorrect =
    current.length === target.length && current.every((c, idx) => c === target[idx]);
  if (alreadyCorrect) {
    return;
  }

  await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
  await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${columns.join(", ")})`);
}

/**
 * Runs at most once, ever, no matter how many times it is invoked: assigns
 * any pre-existing (pre-auth) journal entries, sticky notes, and PIN
 * settings to `firstUserId`, then tightens the schema so user_id is
 * required and forms part of the primary key going forward.
 *
 * Whether this has already run is tracked durably via a row in
 * `schema_migrations` (inserted atomically with ON CONFLICT DO NOTHING), not
 * by inferring state from the `users` table — that heuristic broke
 * permanently if the sole user account was ever deleted after the backfill
 * had already run once. Call this on every signup; it is a cheap no-op
 * after the first successful run. The individual ALTER statements are also
 * idempotent as a safety net for environments already caught in that bug.
 *
 * Must be called from inside the signup transaction (see routes/auth.ts).
 */
export async function backfillFirstUser(client: QueryClient, firstUserId: string): Promise<void> {
  const marker = await client.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING name`,
    [FIRST_USER_BACKFILL_MIGRATION],
  );
  if ((marker.rowCount ?? 0) === 0) {
    return;
  }

  await client.query(`UPDATE journal_entries SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);
  await client.query(`UPDATE sticky_notes SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);
  await client.query(`UPDATE settings SET user_id = $1 WHERE user_id IS NULL`, [firstUserId]);

  await client.query(`ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL`);
  await ensureCompositePrimaryKey(client, "journal_entries", ["user_id", "date"]);

  await client.query(`ALTER TABLE sticky_notes ALTER COLUMN user_id SET NOT NULL`);

  await client.query(`ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL`);
  await ensureCompositePrimaryKey(client, "settings", ["user_id", "key"]);
}
