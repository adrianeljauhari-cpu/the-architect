import { defineConfig } from "@playwright/test";

// E2E only. testDir scopes discovery to tests/e2e so the bundle under blueprints/ is
// never walked (blueprint §19.6 bundle-path exclusion).
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
