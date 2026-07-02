---
name: Vercel serverless function isolated type-check bypasses workspace resolution
description: Vercel's Node.js function builder runs its own separate TypeScript type-check on files under /api, independent of vercel.json's buildCommand, and it cannot resolve pnpm workspace packages correctly.
---

In a pnpm workspace monorepo deployed to Vercel with a custom `vercel.json`
`buildCommand`, Vercel's zero-config Node.js function detection for files
under `/api` performs its **own separate install + TypeScript type-check
pass** on those files, running *after* `buildCommand` completes. This is
independent of whatever the main build script does.

**Why this matters:** Even when the main `buildCommand` correctly compiles
`lib/*` workspace packages first (so consumers never see stale/missing
declaration files), the second, isolated per-function type-check can still
fail with errors like `TS2305: Module has no exported member ...` and
`TS7006: Parameter implicitly has an 'any' type` for a workspace package
import — even though the same import typechecks fine everywhere else in the
repo. The deployment log shows this as a second "Installing dependencies..."
step followed by "Using TypeScript x.y.z (local user-provided)" *after* the
main build output already printed successfully.

**How to apply:** If a Vercel deployment fails with TypeScript errors in an
`/api/*.ts` entry file that cannot be reproduced locally (via `tsc`, the repo
typecheck script, or a full clean `build:vercel` simulation), stop trying to
fix it via tsconfig/module-resolution tweaks — the isolated function checker
does not use the same resolution as the main build. Instead, make the
`/api` entry point a plain `.mjs`/`.js` file that imports the already-bundled
output of the underlying service (e.g. `artifacts/api-server/dist/index.mjs`,
produced by that service's own esbuild bundling step during `buildCommand`)
rather than raw TypeScript source with workspace imports. A plain JS file
with no unresolved workspace-package imports has nothing for Vercel's
isolated checker to fail on.
