import { expect, test } from "@playwright/test";

/**
 * Public `@handle/slug` profile — dev Playwright runs without a runtime
 * worker, so the loader's isDev fallback mints a deterministic mock agent.
 * We verify the page renders the canonical shape: title, badges, and the
 * Fork + Subscribe + Genealogy + Feed action row.
 *
 * Happy-path rendering against a live runtime is covered by the runtime
 * integration tests (api-agents-extended.test.ts) and exercised for real in
 * the production smoke after deploy.
 */

test("/@handle/slug renders dev-mock agent + full action row", async ({ page }) => {
  await page.goto("/@jinhui/hn-digest");

  await expect(page.locator('[data-testid="agent-title"]')).toContainText("hn digest");
  await expect(page.locator('[data-testid="agent-badges"]')).toBeVisible();
  await expect(page.locator('[data-testid="fork-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="subscribe-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="genealogy-link"]')).toBeVisible();
  await expect(page.locator('[data-testid="feed-json-link"]')).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/13-public-agent-404.png", fullPage: false });
});
