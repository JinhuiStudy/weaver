import { expect, test } from "@playwright/test";

/**
 * The public `@handle/slug` profile in isolation — dev Playwright runs
 * without the runtime worker, so /api/public/agents/* comes back 502 via
 * the proxy and the loader throws. We verify the ErrorBoundary renders
 * cleanly rather than crashing the whole app.
 *
 * Happy-path rendering + Fork are covered by runtime integration tests
 * (api-agents-extended.test.ts) and exercised for real in the production
 * smoke after deploy.
 */

test("/@handle/slug ErrorBoundary renders when the runtime is unreachable", async ({ page }) => {
  const res = await page.goto("/@nobody/missing");
  expect(res?.status()).toBeGreaterThanOrEqual(400);

  await expect(page.getByRole("heading", { name: /Agent not found/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /홈으로/ })).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/13-public-agent-404.png", fullPage: false });
});
