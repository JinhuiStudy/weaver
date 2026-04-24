import { expect, test } from "@playwright/test";

/**
 * Sprint 9 — Launch prep: /docs + /@h/s 의 Report flow.
 */

test("/docs · 렌더 + 주요 섹션 7개 존재", async ({ page }) => {
  await page.goto("/docs");

  await expect(page.locator("h1")).toContainText(/Architecture/);

  const expectedKickers = [
    "architecture",
    "data model",
    "terms",
    "budget",
    "decisions",
    "moderation",
  ];
  for (const k of expectedKickers) {
    await expect(page.locator(`[data-docs-section="${k}"]`)).toBeVisible();
  }

  await page.screenshot({
    path: "tests/screenshots/sprint9-docs.png",
    fullPage: true,
  });
});

test("/@h/s · Report 버튼 → 모달 → 제출 → 토스트", async ({ page }) => {
  let posted: unknown = null;
  await page.route("**/api/agents/*/report", async (route) => {
    posted = await route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        reported: true,
        agent_id: "dev-agent-hn-digest",
        reason: "spam",
      }),
    });
  });

  await page.goto("/@jinhui/hn-digest");

  const btn = page.locator('[data-testid="report-button"]');
  await expect(btn).toBeVisible();
  await btn.click();

  const modal = page.locator('[data-testid="report-modal"]');
  await expect(modal).toBeVisible();
  await page.locator('[data-testid="report-reason"]').selectOption("spam");
  await page.locator('[data-testid="report-detail"]').fill("반복되는 output 이 많아요.");
  await page.locator('[data-testid="report-submit"]').click();

  await expect(page.locator('[data-testid="report-toast"]')).toContainText(/신고 접수됨/);
  expect(posted).toMatchObject({ reason: "spam" });

  await page.screenshot({
    path: "tests/screenshots/sprint9-report.png",
    fullPage: false,
  });
});
