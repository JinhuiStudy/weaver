import { expect, test } from "@playwright/test";

/**
 * UX regression · no browser-native alerts; failures surface as in-page
 * toasts or inline error strips with humanised copy.
 */

// Valid ULID so the builder loader renders the mock savedAgent.
const MOCK_ULID = "01HKGB2BRBKVKJAVW3X00SETT0";

test("Fork 실패 · window.alert 대신 rose 토스트 + 친절한 메시지", async ({ page }) => {
  const alerts: string[] = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    d.dismiss();
  });

  await page.route("**/api/agents/*/fork", async (route) => {
    await route.fulfill({ status: 429, body: "rate limited" });
  });

  await page.goto("/@alex/hn-digest");
  await page.locator('[data-testid="fork-button"]').click();

  await expect(page.locator('[data-testid="page-toast-warn"]')).toContainText(/한도/);
  // No native alert should have fired.
  expect(alerts).toHaveLength(0);
});

test("빌더 저장 실패 · window.alert 없음 · warn 토스트 표시", async ({ page }) => {
  const alerts: string[] = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    d.dismiss();
  });

  // savedAgent 있는 상태 (ULID) 에서 POST /versions 가 500
  await page.route(`**/api/agents/${MOCK_ULID}/versions`, async (route) => {
    await route.fulfill({ status: 500, body: "internal" });
  });

  await page.goto(`/builder/${MOCK_ULID}`);
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator('[data-testid="save-to-workspace"]').click();

  await expect(page.locator('[data-testid="builder-toast"]')).toContainText(/실패|이상|시도/);
  expect(alerts).toHaveLength(0);
});

test("Root ErrorBoundary · 매칭 안 되는 경로는 친절 404 + 복귀 링크 3종", async ({ page }) => {
  // 3-segment path 이라 handle-agent 의 :prefixedHandle/:slug 에도 안 걸림 → root
  await page.goto("/zzz/not-a-route/deep");
  await expect(page.getByRole("heading", { name: /찾을 수 없|Error/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /홈으로/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /도움말/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /버그 신고/ })).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/ux-error-404.png", fullPage: false });
});
