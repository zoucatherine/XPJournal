import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";

/**
 * Regression test for the permanent-signup-lockout bug: the first-user
 * legacy-data backfill used to be gated on "is the users table empty?",
 * which broke forever once the sole user account was deleted (the table
 * looked empty again, but the backfill/schema-tightening had already run).
 * The fix tracks completion with a durable, one-row-ever marker in
 * `schema_migrations` instead. See src/migrate.ts (backfillFirstUser) and
 * src/routes/auth.ts.
 *
 * This test runs against a real Postgres instance (DATABASE_URL) but is
 * isolated from the app's normal tables via a dedicated schema, so it never
 * touches real journal/user data.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run the signup regression test");
}

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = `test_signup_regression_${Date.now()}`;

let adminPool: pg.Pool;
let server: http.Server;
let baseUrl: string;
let migrateModule: typeof import("../migrate.js");

async function signup(username: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ORIGINAL_DATABASE_URL });
  await adminPool.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);

  // Point every module that opens its own connection (the shared @workspace/db
  // pool, plus this test's admin pool usage below) at the isolated schema by
  // adding it to the front of the session's search_path.
  const isolatedUrl = new URL(ORIGINAL_DATABASE_URL);
  isolatedUrl.searchParams.set("options", `-c search_path=${TEST_SCHEMA},public`);
  process.env.DATABASE_URL = isolatedUrl.toString();

  // Pre-create the "legacy" pre-auth tables the way they existed before the
  // users/auth feature shipped (no user_id column yet). migrate.ts only ever
  // ALTERs these tables — it never creates them — mirroring production.
  await adminPool.query(`
    CREATE TABLE "${TEST_SCHEMA}".journal_entries (
      date TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      mood TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await adminPool.query(`
    CREATE TABLE "${TEST_SCHEMA}".sticky_notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'yellow',
      pos_x INTEGER NOT NULL DEFAULT 200,
      pos_y INTEGER NOT NULL DEFAULT 200,
      size_w INTEGER,
      size_h INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Seed one "legacy" row per table, predating any user account, exactly
  // like a real pre-auth deployment being upgraded.
  await adminPool.query(
    `INSERT INTO "${TEST_SCHEMA}".journal_entries (date, title, body) VALUES ('2024-01-01', 'Legacy entry', 'Written before auth existed')`,
  );
  await adminPool.query(
    `INSERT INTO "${TEST_SCHEMA}".sticky_notes (id) VALUES ('legacy-note')`,
  );

  migrateModule = await import("../migrate.js");
  await migrateModule.runMigrations();

  // Legacy settings row (settings table + user_id column are created by
  // runMigrations itself).
  await adminPool.query(
    `INSERT INTO "${TEST_SCHEMA}".settings (key, value) VALUES ('pin', '1234')`,
  );

  const { default: app } = await import("../app.js");
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server?.close((err) => (err ? reject(err) : resolve())),
  );
  await adminPool.query(`DROP SCHEMA "${TEST_SCHEMA}" CASCADE`);
  await adminPool.end();
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("signup-after-deletion regression", () => {
  it("backfills legacy data on the first signup and records a durable marker", async () => {
    const { status, body } = await signup("first-user", "correct-horse-battery");
    expect(status).toBe(201);
    const firstUserId = (
      await adminPool.query(`SELECT id FROM "${TEST_SCHEMA}".users WHERE username = 'first-user'`)
    ).rows[0].id as string;
    expect(body).toMatchObject({ username: "first-user" });

    const entry = await adminPool.query(
      `SELECT user_id FROM "${TEST_SCHEMA}".journal_entries WHERE date = '2024-01-01'`,
    );
    expect(entry.rows[0].user_id).toBe(firstUserId);

    const note = await adminPool.query(
      `SELECT user_id FROM "${TEST_SCHEMA}".sticky_notes WHERE id = 'legacy-note'`,
    );
    expect(note.rows[0].user_id).toBe(firstUserId);

    const setting = await adminPool.query(
      `SELECT user_id FROM "${TEST_SCHEMA}".settings WHERE key = 'pin'`,
    );
    expect(setting.rows[0].user_id).toBe(firstUserId);

    const markers = await adminPool.query(
      `SELECT name FROM "${TEST_SCHEMA}".schema_migrations WHERE name = 'first_user_backfill'`,
    );
    expect(markers.rowCount).toBe(1);

    // Deleting the sole user account is the trigger for the regression:
    // the old "is users table empty?" heuristic would look identical to a
    // brand-new install afterwards.
    await adminPool.query(`DELETE FROM "${TEST_SCHEMA}".users WHERE id = $1`, [firstUserId]);
    const usersLeft = await adminPool.query(`SELECT COUNT(*)::int AS count FROM "${TEST_SCHEMA}".users`);
    expect(usersLeft.rows[0].count).toBe(0);

    // A follow-up signup must succeed instead of being permanently locked out.
    const second = await signup("second-user", "another-strong-password");
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ username: "second-user" });

    // The backfill must not have re-run: exactly one marker row, ever.
    const markersAfter = await adminPool.query(
      `SELECT name FROM "${TEST_SCHEMA}".schema_migrations WHERE name = 'first_user_backfill'`,
    );
    expect(markersAfter.rowCount).toBe(1);
  });
});
