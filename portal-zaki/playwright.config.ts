import { defineConfig } from "@playwright/test";

// E2E only. testDir scopes discovery to tests/e2e so the bundle under blueprints/ is
// never walked (blueprint §19.6 bundle-path exclusion).
//
// PW_CHROMIUM_PATH lets a host with a pre-installed Chromium point Playwright at it
// instead of downloading a version-matched build; CI leaves it unset and installs
// browsers the normal way.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Serial: E2E shares one database and one login identity, so no parallelism.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: executablePath
      ? { executablePath, args: ["--no-sandbox"] }
      : undefined,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
