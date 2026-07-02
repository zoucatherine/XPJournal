# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Vercel deployment needs its own external Postgres, not Replit's dev `DATABASE_URL`.** Replit's built-in/managed Postgres (dev DB, hostname like `helium`) is only reachable from inside Replit's network — it cannot be reached from Vercel or any other external host. Pointing Vercel's `DATABASE_URL` at the Replit dev connection string causes signup/login to fail with a 500 (`getaddrinfo ENOTFOUND helium` in the Vercel function logs).
  - Fix: provision a separate, externally-reachable Postgres (e.g. Neon, Supabase, or Vercel's own Postgres marketplace add-on) and set **that** connection string as `DATABASE_URL` in the Vercel project's environment variables. Also set `SESSION_SECRET` (any long random string) in Vercel — it's required for JWT signing and the app throws at startup if it's missing.
  - The app's `runMigrations()` (in `artifacts/api-server/src/migrate.ts`) auto-creates all required tables (including `journal_entries`/`sticky_notes` in their pre-auth shape) on first request, so a brand-new empty external database works out of the box — no manual `drizzle-kit push` needed before first use.
  - After setting env vars in Vercel, trigger a redeploy for them to take effect.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
