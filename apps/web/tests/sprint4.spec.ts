import { expect, test } from "@playwright/test";

/**
 * Sprint 4 — feedback toast on Run Viewer + stats badges on public agent
 * page + genealogy tree page. Uses the dev fallback mock that the loaders
 * inject when the runtime worker is unreachable (Playwright default).
 */

test("Run Viewer · thumbs-up records feedback and surfaces a toast", async ({ page }) => {
  // Intercept the feedback POST so the rating lands without a runtime.
  let posted: unknown = null;
  await page.route("**/api/runs/**/feedback", async (route) => {
    posted = await route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        run_id: "01HRUN-DEMO",
        agent_id: "demo",
        rating: 1,
        comment: null,
        created_at: Date.now(),
      }),
    });
  });

  await page.goto("/tools/demo/runs/01HRUN-DEMO");
  // Rating group only visible on complete runs — our dev mock sets status=complete.
  const group = page.locator('[data-testid="rating-group"]');
  await expect(group).toBeVisible();

  await page.locator('[data-testid="rating-up"]').click();
  await expect(page.locator('[data-testid="rating-toast"]')).toContainText(/피드백 기록됨/);
  expect(posted).toMatchObject({ rating: 1 });

  // After selection, the up button reflects the pressed state (aria-pressed=true).
  await expect(page.locator('[data-testid="rating-up"]')).toHaveAttribute("aria-pressed", "true");

  await page.screenshot({
    path: "tests/screenshots/sprint4-run-viewer-rated.png",
    fullPage: false,
  });
});

test("Public agent page · shows like ratio + fork count + subscriber count badges", async ({
  page,
}) => {
  // The handle-agent loader needs the public agent GET to succeed; intercept it.
  await page.route(/\/api\/public\/agents\/alex\/hn-digest(\?|$)/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "dev-agent-alex",
          slug: "hn-digest",
          name: "HN Digest",
          description: "매일 HN 톱 요약",
          visibility: "public",
          category: "news",
          fork_of_agent_id: null,
          created_at: Date.now() - 86_400_000,
          updated_at: Date.now() - 3_600_000,
        },
        creator: { handle: "alex", name: "Alex", avatar_url: null },
        definition: { nodes: [], edges: [] },
      }),
    });
  });

  await page.goto("/@alex/hn-digest");

  // Dev fallback or intercepted stats — either way the badges should render.
  const badges = page.locator('[data-testid="agent-badges"]');
  await expect(badges).toBeVisible();

  // Genealogy + Feed buttons are present.
  await expect(page.locator('[data-testid="genealogy-link"]')).toBeVisible();
  await expect(page.locator('[data-testid="feed-json-link"]')).toBeVisible();

  await page.screenshot({
    path: "tests/screenshots/sprint4-public-agent.png",
    fullPage: false,
  });
});

test("Genealogy · public agent shows ancestors + descendants as a tree", async ({ page }) => {
  await page.goto("/@alex/hn-digest/genealogy");

  await expect(page.locator("h1")).toContainText(/의 족보/);

  const list = page.locator('[data-testid="genealogy-list"]');
  await expect(list).toBeVisible();

  // Current node badge (`현재`) is present exactly once.
  await expect(list.locator('[data-testid="genealogy-node-current"]')).toHaveCount(1);
  // Dev fallback seeds 1 ancestor + 3 descendants.
  await expect(list.locator('[data-testid="genealogy-node-ancestor"]')).toHaveCount(1);
  await expect(list.locator('[data-testid="genealogy-node-descendant"]')).toHaveCount(3);

  await page.screenshot({
    path: "tests/screenshots/sprint4-genealogy.png",
    fullPage: true,
  });
});
