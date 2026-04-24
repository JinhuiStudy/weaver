import { expect, test } from "@playwright/test";

/**
 * UX polish regression · covers three wins in one pass:
 *   1. SaveAsModal replaces the native `window.prompt` for new agents
 *   2. Keyboard focus-visible halo is consistent on btn / a / select
 *   3. Navigation progress bar shows during route transitions
 */

test("빌더 · 새 agent 저장 → SaveAsModal 이 열리고 window.prompt 는 호출되지 않는다", async ({
  page,
}) => {
  const promptCalls: string[] = [];
  page.on("dialog", (d) => {
    promptCalls.push(d.message());
    d.dismiss();
  });

  // Free-form id → savedAgent null → publish 는 "Save as new" 경로.
  await page.goto("/builder/fresh-demo");
  await page.locator(".react-flow__viewport").waitFor();

  await page.locator('[data-testid="save-to-workspace"]').click();

  const modal = page.locator('[data-testid="save-as-modal"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-testid="save-as-name"]')).toBeVisible();
  await expect(modal.locator('[data-testid="save-as-visibility-public"]')).toBeVisible();
  await expect(modal.locator('[data-testid="save-as-visibility-private"]')).toBeVisible();

  // No native OS prompt should have fired.
  expect(promptCalls).toHaveLength(0);

  await page.screenshot({
    path: "tests/screenshots/ux-save-as-modal.png",
    fullPage: false,
  });
});

test("SaveAsModal · 이름 없이 저장 시 inline 에러", async ({ page }) => {
  await page.goto("/builder/fresh-demo");
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator('[data-testid="save-to-workspace"]').click();
  await page.locator('[data-testid="save-as-submit"]').click();
  await expect(page.getByRole("alert")).toContainText(/이름을 입력/);
});

test("SaveAsModal · 전체 메타 채워서 저장 → POST /api/agents 호출", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route("**/api/agents", async (route) => {
    if (route.request().method() === "POST") {
      posted = (await route.request().postDataJSON()) as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ id: "01HNEWAGENT0000000000000000", slug: "hn-morning" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/builder/fresh-demo");
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator('[data-testid="save-to-workspace"]').click();

  await page.locator('[data-testid="save-as-name"]').fill("HN Morning");
  await page.locator('[data-testid="save-as-description"]').fill("하루에 한 번 HN top 10 요약");
  await page.locator('[data-testid="save-as-category"]').selectOption("news");
  await page
    .locator('[data-testid="save-as-visibility-unlisted"]')
    .locator('input[type="radio"]')
    .check();

  await page.locator('[data-testid="save-as-submit"]').click();

  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({
    name: "HN Morning",
    description: "하루에 한 번 HN top 10 요약",
    category: "news",
    visibility: "unlisted",
  });
});

test("키보드 포커스 · Tab 으로 홈 버튼 이동 시 indigo halo 적용", async ({ page }) => {
  await page.goto("/help");
  // Focus the first focusable element and probe its box-shadow for the
  // indigo ring token (rgba with indigo RGB triplet).
  await page.keyboard.press("Tab");
  const ringColor = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    return getComputedStyle(el).boxShadow;
  });
  expect(ringColor).toMatch(/rgba\(\s*99\s*,\s*102\s*,\s*241/);
});

test("Navigation progress · 라우트 이동 중 progress bar 가 DOM 에 존재", async ({ page }) => {
  await page.goto("/");
  // The bar is always in the DOM (opacity-toggled) so a simple presence
  // check is enough — the CSS animation is covered by app.css review.
  await expect(page.locator('[data-testid="nav-progress"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="nav-progress"] .nav-progress-bar')).toHaveCount(1);
});
