import { expect, test } from "@playwright/test";

/**
 * Sprint 2 D5: Run Viewer (/tools/:toolId/runs/:runId).
 *
 * In dev (Playwright) the runtime worker is offline, so the loader's
 * isDev() fallback mints a realistic 4-step history. We assert the
 * waterfall renders, stat tiles show concrete numbers, and clicking
 * a row surfaces the span detail panel.
 */

test("waterfall renders every step with a duration badge", async ({ page }) => {
  await page.goto("/tools/demo/runs/01HRUN-DEMO");

  await expect(page.locator("h1", { hasText: /Trace/ })).toBeVisible();
  // trace id short-form in the header.
  await expect(page.getByText(/trace aaaaaaaaaaaa/)).toBeVisible();

  // 4 rows from devMockRun.
  const rows = page.locator('[data-testid^="waterfall-row-"]');
  await expect(rows).toHaveCount(4);

  // Stat tiles have concrete values (not "—").
  await expect(page.locator('[data-testid="stat-duration"]')).not.toHaveText("—");
  await expect(page.locator('[data-testid="stat-steps"]')).toHaveText("4");
  await expect(page.locator('[data-testid="stat-cost"]')).not.toHaveText("—");

  await page.screenshot({
    path: "tests/screenshots/sprint2-run-viewer.png",
    fullPage: false,
  });
});

test("clicking a waterfall row opens its span detail panel", async ({ page }) => {
  await page.goto("/tools/demo/runs/01HRUN-DEMO");

  // Empty state copy is visible BEFORE selection.
  await expect(page.getByText(/span 을 선택하세요/)).toBeVisible();

  // Click the agent step (index 1).
  await page.locator('[data-testid="waterfall-row-1"]').click();
  await page.waitForTimeout(100);

  // Detail panel shows node_type + span_id.
  await expect(page.getByText(/node_type/i).first()).toBeVisible();
  await expect(page.getByText("0000000000000002")).toBeVisible();
  // Output disclosure present.
  await expect(page.locator("summary", { hasText: /output/i }).first()).toBeVisible();

  await page.screenshot({
    path: "tests/screenshots/sprint2-run-viewer-selected.png",
    fullPage: false,
  });
});

test("home · logged-in user sees the neurons gauge and recent runs list", async ({ page }) => {
  await page.goto("/");
  // Dev session puts neurons.remaining at 43/50.
  const gauge = page.locator('[data-testid="neurons-gauge"]');
  await expect(gauge).toBeVisible();
  await expect(gauge).toContainText("43");
  await expect(gauge).toContainText("/50");

  const section = page.locator('[data-testid="recent-runs-section"]');
  await expect(section).toBeVisible();
  // 3 dev-mock runs → 3 rows visible.
  await expect(section.locator('[data-testid="run-row"]')).toHaveCount(3);

  // Capture the home with gauge + recent runs BEFORE navigation.
  await page.screenshot({
    path: "tests/screenshots/sprint2-home-runs-gauge.png",
    fullPage: true,
  });

  // Clicking a row navigates to the run viewer.
  await section.locator('[data-testid="run-row"]').first().click();
  await expect(page.locator("h1", { hasText: /Trace/ })).toBeVisible();
});
