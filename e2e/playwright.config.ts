import { defineConfig, devices } from "@playwright/test";

/**
 * The central demo flow runs the web app against the public-data-api. By
 * default the API uses the DETERMINISTIC FALLBACK backend
 * (RECALLLENS_USE_LIVE=0) so the E2E is reproducible in CI without a running
 * devnet. The genuine on-chain proof is verified separately by
 * `npm run e2e-convergence -w @recalllens/midnight-client`.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // The API's deterministic-fallback backend is a single stateful process, so
  // convergence-mutating tests must not race across workers. Serialize.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    {
      command:
        "RECALLLENS_USE_LIVE=0 PORT=8787 npm run start -w @recalllens/public-data-api",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: !process.env.CI,
      cwd: "..",
      timeout: 60_000,
    },
    {
      command: "npm run dev -w @recalllens/web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      cwd: "..",
      timeout: 60_000,
    },
  ],
});
