import { expect, test } from "@playwright/test";

/**
 * Sprint 3 D5 — /search UI.
 *
 * Dev fallback in the loader returns 3 sample agents for any q, so we can
 * exercise the full flow (home → type → submit → result grid → click → agent
 * page) without a live runtime.
 */

test("home · hero has a search input that submits to /search", async ({ page }) => {
  await page.goto("/");
  const form = page.locator('[data-testid="home-search-form"]');
  await expect(form).toBeVisible();
  await page.locator('[data-testid="home-search-input"]').fill("news");
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/search\?q=news$/);
  const results = page.locator('[data-testid="search-results"]');
  await expect(results).toBeVisible();
});

test("/search page · empty q shows hint, valid q shows cards", async ({ page }) => {
  await page.goto("/search");
  await expect(page.locator('[data-testid="search-empty"]')).toBeVisible();

  await page.goto("/search?q=news");
  const cards = page.locator('[data-testid="search-result"]');
  await expect(cards).toHaveCount(3);
  // Each card links to /@handle/slug.
  const firstHref = await cards.first().getAttribute("href");
  expect(firstHref).toMatch(/^\/@[\w-]+\/[\w-]+$/);

  await page.screenshot({ path: "tests/screenshots/sprint3-search.png", fullPage: true });
});

test("/search · category chip toggles filter", async ({ page }) => {
  await page.goto("/search?q=news");
  // Active chip is "전체" initially.
  const all = page.locator('[data-testid="category-chip-all"]');
  await expect(all).toBeVisible();

  const productivity = page.locator('[data-testid="category-chip-productivity"]');
  await productivity.click();
  await expect(page).toHaveURL(/category=productivity/);
  // URL param preserved as a link href; productivity chip is now the active style.
  await expect(productivity).toHaveClass(/border-weaver-indigo/);
});
