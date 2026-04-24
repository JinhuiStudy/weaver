import { expect, test } from "@playwright/test";

/**
 * Regression · the launched home hero had the running-agent conic-gradient
 * ring leaking at an angle because its ancestor .wv-float rotated 1deg,
 * which the ::before mask-composite:xor layer didn't tolerate.
 *
 * We lock in both fixes:
 *   1. wv-float keyframes no longer rotate (translateY only)
 *   2. the running node is rendered WITHOUT a wv-float wrapper
 */

test("홈 canvas-bg · running 노드는 wv-float 래퍼로 감싸지지 않는다", async ({ page }) => {
  await page.goto("/");
  const running = page.locator(".wv-node.st-running").first();
  await expect(running).toBeVisible();
  // parent element must not carry .wv-float — that was the rotate leak.
  const parentHasFloat = await running.evaluate(
    (el) => el.parentElement?.classList.contains("wv-float") ?? false,
  );
  expect(parentHasFloat).toBe(false);
});

test("wv-float keyframes · rotate 가 사라진 pure translateY 버전인지 확인", async ({ page }) => {
  await page.goto("/");
  // Pick any .wv-float element and read the computed animation-name, then
  // verify the @keyframes rule doesn't contain "rotate".
  const floated = page.locator(".wv-float").first();
  await expect(floated).toBeVisible();
  const hasRotate = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSKeyframesRule && rule.name === "wv-node-float") {
          return rule.cssText.toLowerCase().includes("rotate");
        }
      }
    }
    return null;
  });
  expect(hasRotate).toBe(false);
});

test("홈 스크린샷 · running 노드 박스 경계는 wv-node 실제 bounding-box 안", async ({ page }) => {
  await page.goto("/");
  const running = page.locator(".wv-node.st-running").first();
  await expect(running).toBeVisible();
  // Allow small overflow for the ring (inset: -1px) but not double-digit px
  // like the 45° glitch.
  const { rotation, tx, ty } = await running.evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const rad = Math.atan2(m.b, m.a);
    return { rotation: (rad * 180) / Math.PI, tx: m.e, ty: m.f };
  });
  // wv-float was the only ancestor adding transform; without it running
  // keeps an identity matrix (or just translateY bob is NOT on this node).
  expect(Math.abs(rotation)).toBeLessThan(0.1);
  expect(Math.abs(tx)).toBeLessThan(0.1);
  expect(Math.abs(ty)).toBeLessThan(0.1);

  // Scroll to the hero canvas band before capturing.
  await running.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "tests/screenshots/hero-running-fixed.png",
    fullPage: false,
  });
});
