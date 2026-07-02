// Vercel serverless function entry point
// This imports the pre-bundled Express app (built by `pnpm run build:vercel`)
// instead of raw TypeScript source. Vercel's Node function builder performs
// its own isolated TypeScript type-check of files under /api, and that check
// cannot resolve pnpm workspace packages (@workspace/api-zod, @workspace/db)
// correctly in its isolated context. Using the already-bundled, dependency-free
// JS output avoids that check entirely.
import app from "../artifacts/api-server/dist/index.mjs";

export default app;
