---
name: health.ts Express v5 typing regression
description: Explicit Request/Response type annotations on Express v5 route handlers cause TS errors; this repo's health.ts route keeps having this bug reintroduced via merges/rebases.
---

This project uses Express v5. Route handler callbacks (e.g.
`router.get("/path", (_req, res) => {...})`) must be left **without**
explicit `Request`/`Response` type annotations. Express v5's own types
correctly infer the handler parameter types from the router context.

**Why:** Adding `import type { Request, Response } from "express"` and
annotating `(_req: Request, res: Response)` breaks type inference — TS ends
up resolving `Response` to something incompatible (e.g. missing `.json()`),
producing errors like:
- `Property 'json' does not exist on type 'Response<any, Record<string, any>>'`
- `Module '@workspace/api-zod' has no exported member 'HealthCheckResponse'`
  (this second error is usually a red herring caused by the same
  type-resolution confusion, not a real missing export).

**How to apply:** If `artifacts/api-server/src/routes/health.ts` (or any
other Express v5 route file) shows these errors, check whether explicit
`Request`/`Response` annotations were reintroduced (often via a merge/rebase
conflict where the "add explicit types to fix strict mode" side was
mistakenly kept). The fix is always to remove the explicit annotations and
the `import type { Request, Response }` line, letting Express v5 infer the
types. Do not re-add them even if it seems like it would satisfy
`noImplicitAny` — it doesn't, and it breaks the build instead.
