---
name: api-server DB integration tests use an isolated schema
description: Pattern for writing vitest integration tests against the real dev DATABASE_URL without touching real app data.
---

`artifacts/api-server` has no fixture/mocking layer around Postgres — routes and
migrations talk to the real `@workspace/db` pool directly. Integration tests
for this package should run against the real dev `DATABASE_URL` (not a mock),
but must not truncate or mutate the shared `public` schema, since it holds
real app data.

**Pattern:** before importing any app module, create a throwaway Postgres
schema and repoint `process.env.DATABASE_URL` at it via the connection
string's `options=-c search_path=<schema>,public` query param, then
dynamically `import()` the modules under test (migrate.ts, app.ts, etc.) so
they pick up the new env var when the `@workspace/db` singleton pool is
constructed. Drop the schema in `afterAll`.

**Why:** `@workspace/db`'s pool is a module-level singleton created at import
time from `process.env.DATABASE_URL`; there's no dependency-injection seam to
swap it per-test. Mutating the env var before first import is the only way to
redirect it without touching production code, and scoping via `search_path`
avoids ever running DDL/DML against the real tables.

**How to apply:** see `artifacts/api-server/src/routes/auth.signup-after-deletion.test.ts`
for a working example (vitest + `pg` admin pool + `http.createServer` to hit
the Express app). Reuse this pattern for any new api-server integration test
rather than mocking the DB layer.
