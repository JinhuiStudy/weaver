import { expect, test } from "@playwright/test";

/**
 * /help — comprehensive user guide covering every page + shortcuts + quotas.
 * We verify the TOC anchors, every major section heading, and that the help
 * link lives in every reachable surface so users can always find it.
 */

test("/help renders hero · TOC · every page guide section", async ({ page }) => {
  await page.goto("/help");

  // Hero
  await expect(page.locator("h1")).toContainText(/모든 사용법/);

  // TOC must list every major section id.
  const expectedIds = [
    "quickstart",
    "home",
    "login",
    "builder",
    "public-agent",
    "run-viewer",
    "design-system",
    "shortcuts",
    "quotas",
    "evolution",
    "faq",
    "links",
  ];
  for (const id of expectedIds) {
    await expect(page.locator(`a[href="#${id}"]`).first()).toBeVisible();
    await expect(page.locator(`section#${id}`)).toBeVisible();
  }

  // Each section has a headline (h2) with a data attribute we set.
  const sectionsWithKicker = [
    "quickstart",
    "/",
    "/login",
    "/builder/:id",
    "/@handle/slug",
    "/tools/:toolId/runs/:runId",
    "/design",
    "keyboard",
    "quotas",
    "terms",
    "faq",
    "references",
  ];
  for (const kicker of sectionsWithKicker) {
    await expect(page.locator(`[data-help-section="${kicker}"]`)).toHaveCount(1);
  }

  // Every key shortcut ⌘K ⌘S Delete 가 본문에 등장.
  for (const key of ["⌘", "K", "S", "Delete", "Esc"]) {
    await expect(page.locator("section#shortcuts")).toContainText(key);
  }

  await page.screenshot({
    path: "tests/screenshots/help-full.png",
    fullPage: true,
  });
});

test("/help TOC anchor links navigate inside the page", async ({ page }) => {
  await page.goto("/help");
  await page.locator('a[href="#builder"]').first().click();
  // URL changed to include the hash.
  await expect(page).toHaveURL(/#builder$/);
  // The builder section is actually visible in the viewport.
  await expect(page.locator("section#builder")).toBeInViewport();
});

test("home · help links live in header and hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid="home-help-link"]')).toBeVisible();
  await expect(page.locator('[data-testid="hero-help-link"]')).toBeVisible();

  await page.screenshot({
    path: "tests/screenshots/home-redesigned.png",
    fullPage: true,
  });
});

test("login · carries a help link underneath the CTA", async ({ page }) => {
  await page.goto("/login");
  const link = page.locator('[data-testid="login-help-link"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/help$/);
});

test("run viewer · help link jumps to the relevant /help section", async ({ page }) => {
  await page.goto("/tools/demo/runs/01HRUN-DEMO");
  const link = page.locator('[data-testid="run-viewer-help-link"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/help#run-viewer$/);
  await expect(page.locator("section#run-viewer")).toBeInViewport();
});
