import { expect, test } from "@playwright/test";

/**
 * Sprint 7 — /explore · Trending / New / Category filter.
 * Dev fallback seeds 4 public agents; category filter shrinks the list.
 */

test("/explore · defaults to Trending with 24h window + shows 4 dev cards", async ({ page }) => {
  await page.goto("/explore");

  await expect(page.locator("h1")).toContainText(/핫한 agent/);
  await expect(page.locator('[data-testid="explore-tab-trending"]')).toHaveClass(
    /border-weaver-indigo/,
  );

  const grid = page.locator('[data-testid="explore-grid"]');
  await expect(grid).toBeVisible();
  await expect(grid.locator('[data-testid="explore-card"]')).toHaveCount(4);

  await page.screenshot({
    path: "tests/screenshots/sprint7-explore.png",
    fullPage: true,
  });
});

test("/explore?category=news · filters to news-only cards", async ({ page }) => {
  await page.goto("/explore?tab=trending&category=news");
  const grid = page.locator('[data-testid="explore-grid"]');
  await expect(grid).toBeVisible();
  await expect(grid.locator('[data-testid="explore-card"]')).toHaveCount(2);
  // HN Daily Digest + GitHub Trending are both category=news in the dev fallback.
  await expect(grid).toContainText("HN Daily Digest");
  await expect(grid).toContainText("GitHub Trending");
});

test("Home · Explore link is in the nav", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid="home-explore-link"]')).toBeVisible();
  await page.locator('[data-testid="home-explore-link"]').click();
  await expect(page).toHaveURL(/\/explore$/);
});
