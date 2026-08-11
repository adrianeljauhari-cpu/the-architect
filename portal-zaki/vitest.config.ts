import path from "node:path";
import { defineConfig } from "vitest/config";

// Alias @/ -> ./src so tests resolve modules the same way the app and tsx scripts do
// (see blueprint §19.6 resolution convention matrix). dotenv is loaded in tests/setup.ts
// so standalone-invoked tools reading TEST_DATABASE_URL find it.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "blueprints/**", "tests/e2e/**"],
    // Integration suites share one Postgres, so run files sequentially to avoid
    // cross-file races on shared rows (each file still cleans up its own scope).
    fileParallelism: false,
  },
});
