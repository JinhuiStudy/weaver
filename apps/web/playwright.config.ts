import { defineConfig, devices } from "@playwright/test";

/**
 * Run locally with:
 *   pnpm --filter=@weaver/web exec playwright test
 *
 * Screenshots land in `tests/screenshots/` (committed) so changes show up in git.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
