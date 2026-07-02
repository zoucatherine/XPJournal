---
name: Vercel deployments cannot reach Replit's managed Postgres
description: Why a Vercel-deployed app gets signup/login/DB 500s even though DATABASE_URL is set, and what "fixed" means here.
---

Replit's built-in/managed Postgres (dev database, hostname like `helium`) is only
reachable from inside Replit's own network. It cannot be reached from Vercel,
or any other external host — there is no publicly reachable connection string
for it. If a Vercel deployment's `DATABASE_URL` is set to the Replit dev
connection string, every DB call fails at connect time
(`getaddrinfo ENOTFOUND helium`), which surfaces as generic 500s on any route
that touches the DB (e.g. signup/login).

**Why:** Confirmed via Vercel runtime logs showing `ENOTFOUND helium` during
migration/connection, and via `searchIntegrations` returning no external
Postgres connector (e.g. Neon) available in Replit's integrations system —
so there's no one-click Replit-side fix for this combination.

**How to apply:** When a project is deployed via an external platform (Vercel,
Netlify, etc.) rather than Replit's own Publish/Deployments, it needs its own
externally-reachable Postgres (Neon, Supabase, Vercel Postgres marketplace,
etc.) with that connection string set as `DATABASE_URL` in the external
platform's env vars — separate from the Replit dev `DATABASE_URL`. Also
double check any other required secrets (e.g. a JWT/session signing secret)
are set there too, since they won't inherit from Replit's dev secrets.

Separately: if the app's schema was originally created via a one-off
`drizzle-kit push` (rather than by the app's own runtime migration code), a
brand-new external database will be missing those tables entirely. Prefer
making runtime migrations self-sufficient (`CREATE TABLE IF NOT EXISTS` for
everything the app needs) so a fresh external DB works without a manual push
step — verified working end-to-end (signup + login) against an empty schema.
