---
name: Stale tsbuildinfo hides missing lib dist files
description: tsc --build (incremental) can exit 0 without actually emitting .d.ts files if a stale tsbuildinfo cache thinks the build is already up to date.
---

In this pnpm monorepo, `lib/*` packages use composite TypeScript projects with
`emitDeclarationOnly` + `declarationMap`, built via root `tsc --build`
(`typecheck:libs` script). Each package has its own `tsconfig.tsbuildinfo`
(or `.tsbuildinfo`) cache tracking whether declaration output is current.

**Symptom:** `tsc --build` runs and exits successfully, but a package's
`dist/` only contains `.d.ts.map` files — the actual `.d.ts` files are
missing. Downstream consumers then fail with TS6305 ("Output file has not
been built from source") or TS2305 ("has no exported member ...").

**Why:** The tsbuildinfo cache can get out of sync with the real `dist/`
contents (e.g. dist/ was manually deleted, or a prior interrupted build left
inconsistent state, or merge history mixed source and no-longer-matching
dist artifacts). `tsc --build` trusts the cache and treats the project as
already up to date, so it silently skips actually emitting the missing files.

**How to apply:** If a clean/CI build shows "no exported member" or TS6305
errors from a `lib/` package even after running `typecheck:libs`, don't just
re-run the build — delete that package's `tsconfig.tsbuildinfo` (or
`.tsbuildinfo`) file AND its `dist/` folder, then rebuild. Re-running with a
stale cache in place will not fix it. This project's Vercel build script
(`build:vercel`) runs `typecheck:libs` before building artifacts specifically
to avoid consumers compiling against missing lib declarations — but that only
helps if the lib tsbuildinfo caches are themselves trustworthy.
