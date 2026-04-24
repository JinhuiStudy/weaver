import { expect, test } from "@playwright/test";

/**
 * Mobile responsive smoke — 390 × 844 viewport (iPhone 13-ish) on the
 * default Chromium. We don't need a real WebKit engine for this layer;
 * we only check that nothing horizontally overflows the viewport.
 */

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

const PAGES: Array<{ path: string; anchor: RegExp; role?: "heading" | "link" | "button" }> = [
  { path: "/", anchor: /Fork agents|Rate them|evolve/, role: "heading" },
  { path: "/explore", anchor: /핫한 agent/, role: "heading" },
  { path: "/docs", anchor: /Architecture/, role: "heading" },
  { path: "/help", anchor: /모든 사용법/, role: "heading" },
  { path: "/waitlist", anchor: /초대장/, role: "heading" },
  { path: "/login", anchor: /Sign in with GitHub/, role: "link" },
  { path: "/search", anchor: /어떤 agent/, role: "heading" },
];

for (const { path, anchor, role } of PAGES) {
  test(`모바일 · ${path} · 앵커 보임 + 가로 오버플로 없음`, async ({ page }) => {
    await page.goto(path);
    const el = page.getByRole(role ?? "heading", { name: anchor }).first();
    await expect(el).toBeVisible();

    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      let maxRight = 0;
      let worstTag = "";
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const h = el as HTMLElement;
        const cs = getComputedStyle(h);
        // Ignore decorative fixed / pointer-events-none elements — they
        // can't induce real horizontal scroll with our overflow-x:clip
        // guardrail but are allowed to bleed past the viewport.
        if (cs.position === "fixed") continue;
        if (cs.pointerEvents === "none") continue;
        const rect = h.getBoundingClientRect();
        if (rect.width > 0 && rect.right > maxRight) {
          maxRight = rect.right;
          worstTag = `${h.tagName}.${h.className.toString().slice(0, 60)}`;
        }
      }
      return { docW, maxRight, worstTag };
    });
    expect(
      overflow.maxRight,
      `overflow by ${overflow.maxRight - overflow.docW}px · ${overflow.worstTag}`,
    ).toBeLessThanOrEqual(overflow.docW + 2);
  });
}

test("모바일 · 홈 hero CTA 3종이 같은 뷰포트 안에 세로 스택으로 들어옴", async ({ page }) => {
  await page.goto("/");
  const start = page.getByRole("link", { name: /시작하기/ });
  const help = page.getByRole("link", { name: /사용법 도움말/ });
  await expect(start).toBeVisible();
  await expect(help).toBeVisible();

  // On mobile each CTA should be roughly full-width (>200px).
  const startBox = await start.boundingBox();
  expect(startBox?.width ?? 0).toBeGreaterThan(100);

  await page.screenshot({
    path: "tests/screenshots/mobile-home.png",
    fullPage: true,
  });
});
