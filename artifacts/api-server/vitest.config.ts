import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Regression tests hit the real database sequentially against a
    // dedicated, isolated schema — run in a single fork to avoid
    // cross-file interference with shared module-level pg pools.
    pool: "forks",
    fileParallelism: false,
  },
});
