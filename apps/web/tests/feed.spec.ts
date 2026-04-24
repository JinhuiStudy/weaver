import { expect, test } from "@playwright/test";

/**
 * Sprint 3 D3: /me/feed — aggregated timeline from subscribed agents.
 * In dev the runtime worker is offline, so the loader's isDev fallback
 * seeds 4 realistic items. The page renders them as a scrollable list.
 */

test("/me/feed renders 4 subscribed items in dev fallback", async ({ page }) => {
  await page.goto("/me/feed");

  await expect(page.locator("h1")).toContainText(/구독 피드/);
  const list = page.locator('[data-testid="my-feed-list"]');
  await expect(list).toBeVisible();
  await expect(list.locator('[data-testid="feed-item"]')).toHaveCount(4);

  // First item should be the most recent — 3분 전.
  const first = list.locator('[data-testid="feed-item"]').first();
  await expect(first).toContainText("HN Digest");
  await expect(first).toContainText("3분 전");

  await page.screenshot({ path: "tests/screenshots/sprint3-me-feed.png", fullPage: true });
});

test("home · '내 구독 피드' strip links to /me/feed", async ({ page }) => {
  await page.goto("/");
  const strip = page.locator('[data-testid="feed-link-strip"]');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("내 구독 피드");
  await strip.locator("a").click();
  await expect(page).toHaveURL(/\/me\/feed$/);
});
