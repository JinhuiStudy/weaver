import { expect, test } from "@playwright/test";

/**
 * Sprint 1 carry-over: Agent metadata edit via the Settings modal.
 *
 * /builder/{ULID} in dev mode injects a mock `savedAgent` (see builder.$id.tsx
 * loader's isDev fallback) so the Settings button renders without a live
 * runtime. We intercept the PATCH on the client side — that part IS real
 * browser fetch and page.route() handles it.
 */

// Valid Crockford ULID — 26 chars, timestamp-first. Used to trigger the
// ULID_RE branch in the loader.
const MOCK_ULID = "01HKGB2BRBKVKJAVW3X00SETT0";

test("free-form id → no Settings button (savedAgent is null)", async ({ page }) => {
  await page.goto("/builder/demo");
  await page.locator(".react-flow__viewport").waitFor();
  // Header reads "tool" kicker + raw id when there's no saved agent.
  await expect(page.locator('[data-testid="builder-title"]')).toHaveText("demo");
  await expect(page.locator('[data-testid="open-settings"]')).toHaveCount(0);
});

test("ULID id → Settings button present · modal edits metadata via PATCH", async ({ page }) => {
  let lastPatchBody: unknown = null;
  // Intercept the client-side PATCH. Loader SSR call is not interceptable
  // (server-side fetch), but in dev isDev() fallback mints a mock agent so
  // the form has state to edit.
  await page.route(`**/api/agents/${MOCK_ULID}`, async (route) => {
    if (route.request().method() === "PATCH") {
      lastPatchBody = await route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_ULID,
          slug: "dev-agent",
          name: "Edited Name",
          description: "Edited description.",
          category: "research",
          visibility: "unlisted",
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`/builder/${MOCK_ULID}`);
  await page.locator(".react-flow__viewport").waitFor();

  // Settings button is visible because savedAgent (mock) exists.
  const settingsBtn = page.locator('[data-testid="open-settings"]');
  await expect(settingsBtn).toBeVisible();

  // Title reflects the mock agent name, not the raw ULID.
  await expect(page.locator('[data-testid="builder-title"]')).toHaveText("Dev Agent");

  await settingsBtn.click();
  const modal = page.locator('[data-testid="settings-modal"]');
  await expect(modal).toBeVisible();

  // Pre-filled from savedAgent.
  await expect(page.locator('[data-testid="settings-name"]')).toHaveValue("Dev Agent");

  // Edit every field.
  await page.locator('[data-testid="settings-name"]').fill("Edited Name");
  await page.locator('[data-testid="settings-description"]').fill("Edited description.");
  await page.locator('[data-testid="settings-category"]').selectOption("research");
  await page
    .locator('[data-testid="settings-visibility-unlisted"]')
    .locator('input[type="radio"]')
    .check();

  await page.screenshot({
    path: "tests/screenshots/sprint1-settings-filled.png",
    fullPage: false,
  });

  await page.locator('[data-testid="settings-save"]').click();

  // Modal closes on success; header reflects the edited name + visibility.
  await expect(modal).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('[data-testid="builder-title"]')).toHaveText("Edited Name");

  await page.screenshot({
    path: "tests/screenshots/sprint1-settings-after-save.png",
    fullPage: false,
  });

  // Payload body reached PATCH with trimmed values.
  expect(lastPatchBody).toMatchObject({
    name: "Edited Name",
    description: "Edited description.",
    category: "research",
    visibility: "unlisted",
  });
});

test("Settings modal surfaces PATCH errors", async ({ page }) => {
  await page.route(`**/api/agents/${MOCK_ULID}`, async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "visibility must be public|unlisted|private" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`/builder/${MOCK_ULID}`);
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator('[data-testid="open-settings"]').click();
  await page.locator('[data-testid="settings-modal"]').waitFor();
  await page.locator('[data-testid="settings-save"]').click();

  await expect(page.locator('[role="alert"]')).toContainText(/저장 실패/);
});
