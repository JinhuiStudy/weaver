import { expect, test } from "@playwright/test";

/**
 * Sprint 5 D4: admin · /admin/evolutions dashboard.
 * Dev fallback seeds 5 candidates (one per strategy) in mixed statuses.
 */

test("/admin/evolutions · renders the 3 metric tiles + table", async ({ page }) => {
  await page.goto("/admin/evolutions");

  await expect(page.locator("h1")).toContainText(/Evolutions/);

  // Metric tiles
  await expect(page.locator('[data-testid="metric-suggested"]')).toBeVisible();
  await expect(page.locator('[data-testid="metric-accepted"]')).toBeVisible();
  await expect(page.locator('[data-testid="metric-rejected"]')).toBeVisible();

  // Table with 5 rows (one per strategy, per the dev fallback).
  const rows = page.locator('[data-testid="evolution-row"]');
  await expect(rows).toHaveCount(5);

  await page.screenshot({
    path: "tests/screenshots/sprint5-admin-evolutions.png",
    fullPage: true,
  });
});
