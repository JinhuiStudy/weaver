import { expect, test } from "@playwright/test";

/**
 * Sprint 6: evolution candidate diff viewer + accept/reject.
 * Dev fallback seeds 5 candidates in mixed states (3 suggested, 1 rejected,
 * 1 pending-eval). Accepting a suggested one flips it to accepted locally.
 */

test("/agents/:id/evolutions · shows diff cards per strategy with accept/reject affordances", async ({
  page,
}) => {
  await page.goto("/agents/dev-agent-demo/evolutions");

  await expect(page.locator("h1")).toContainText(/진화 제안/);

  const cards = page.locator('[data-testid="evo-card"]');
  await expect(cards).toHaveCount(5);

  // The 3 suggested ones have Accept/Reject buttons.
  const acceptButtons = page.locator('[data-testid^="evo-accept-"]');
  await expect(acceptButtons).toHaveCount(3);

  await page.screenshot({
    path: "tests/screenshots/sprint6-evolutions.png",
    fullPage: true,
  });
});

test("Accept button hits /api/evolutions/:id/accept and shows the v2-promotion toast", async ({
  page,
}) => {
  let accepted = "";
  await page.route("**/api/evolutions/*/accept", async (route) => {
    accepted = route.request().url();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        evolution_id: "dev-evo-1",
        agent_id: "dev-agent-demo",
        new_version_id: "new-ver-1",
        new_version: 2,
        strategy: "concise",
        accepted_at: Date.now(),
      }),
    });
  });

  await page.goto("/agents/dev-agent-demo/evolutions");
  // `concise` is the first suggested one in the dev fallback.
  await page.locator('[data-testid="evo-accept-concise"]').click();
  await expect(page.locator('[data-testid="evo-toast"]')).toContainText(/v2/);
  expect(accepted).toContain("/api/evolutions/");
  expect(accepted).toContain("/accept");
});
