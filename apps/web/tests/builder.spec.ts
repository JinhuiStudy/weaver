import { expect, type Page, test } from "@playwright/test";

/**
 * /builder/:id smoke tests. Each test captures a screenshot under
 * tests/screenshots/ so we can eyeball regressions visually.
 *
 * The tool id is randomized so IndexedDB for the ":id" is always empty
 * — otherwise a previous run's state would leak in and invalidate the
 * "seed data was hydrated" assumption.
 */
function newToolId() {
  return `pwtest-${Math.random().toString(36).slice(2, 10)}`;
}

async function gotoBuilder(page: Page, id: string) {
  await page.goto(`/builder/${id}`);
  // Wait for the xyflow viewport + at least one node to render.
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator(".wv-node").first().waitFor();
  // Extra settle so xyflow finishes fitView animation.
  await page.waitForTimeout(400);
}

test("initial render — home, design, builder all reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Weaver/);
  await page.screenshot({ path: "tests/screenshots/01-home.png", fullPage: false });

  await page.goto("/design");
  await page.locator("h1").first().waitFor();
  await page.screenshot({ path: "tests/screenshots/02-design-hero.png", fullPage: false });

  const id = newToolId();
  await gotoBuilder(page, id);
  await page.screenshot({ path: "tests/screenshots/03-builder-seeded.png", fullPage: false });
});

test("body preserves newlines inside the canvas node", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // Click the HTTP output node; its seeded body contains a newline.
  const outputNode = page.locator(".wv-node.n-output").filter({ hasText: "approve_refund" });
  await outputNode.click();
  await page.waitForTimeout(150);

  // Canvas body should show "return 200" and "body: { ok: true }" on SEPARATE
  // lines (pre-line). We assert geometry: the <div class="body"> should have
  // scrollHeight greater than a single-line height.
  const body = outputNode.locator(".body");
  await expect(body).toContainText("return 200");
  await expect(body).toContainText("body: { ok: true }");
  const heights = await body.evaluate((el) => ({
    scroll: (el as HTMLElement).scrollHeight,
    line: parseFloat(getComputedStyle(el).lineHeight),
  }));
  // A two-line body must exceed ~1.5× the line-height.
  expect(heights.scroll).toBeGreaterThan(heights.line * 1.5);

  await page.screenshot({ path: "tests/screenshots/10-body-newline.png", fullPage: false });
});

test("inspector updates when switching between nodes", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const inspectorLabel = page.locator('aside:has(input) input[placeholder="policy_check"]');

  // Click the agent first → inspector shows policy_check
  const agent = page.locator(".wv-node.n-agent").first();
  await agent.click();
  await page.waitForTimeout(150);
  await expect(inspectorLabel).toHaveValue("policy_check");
  await page.screenshot({ path: "tests/screenshots/20-inspector-agent.png", fullPage: false });

  // Click the input node → inspector should now show refund_received (NOT policy_check)
  const input = page.locator(".wv-node.n-input").first();
  await input.click();
  await page.waitForTimeout(150);
  await expect(inspectorLabel).toHaveValue("refund_received");
  await page.screenshot({ path: "tests/screenshots/21-inspector-input.png", fullPage: false });

  // Click a tool node → inspector should show stripe_lookup
  const tool = page.locator(".wv-node.n-tool").first();
  await tool.click();
  await page.waitForTimeout(150);
  await expect(inspectorLabel).toHaveValue("stripe_lookup");
  await page.screenshot({ path: "tests/screenshots/22-inspector-tool.png", fullPage: false });
});

test("branch outputs add/remove reflect on canvas immediately (+ cascade edges)", async ({
  page,
}) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const allEdges = page.locator(".react-flow__edge");
  const baselineEdgeCount = await allEdges.count();

  const branch = page.locator(".wv-node.n-branch").first();
  await branch.click();
  await page.waitForTimeout(150);

  const branchHandles = branch.locator(".react-flow__handle-right");
  await expect(branchHandles).toHaveCount(2);
  await page.screenshot({
    path: "tests/screenshots/30-branch-initial.png",
    fullPage: false,
  });

  // Add output "reject" via inspector.
  const addInput = page.locator('input[placeholder="approve"]');
  await addInput.fill("reject");
  await page.locator("button", { hasText: "추가" }).click();
  await page.waitForTimeout(200);

  await expect(branchHandles).toHaveCount(3);
  // Adding a port shouldn't create a connection on its own.
  await expect(allEdges).toHaveCount(baselineEdgeCount);
  await page.screenshot({
    path: "tests/screenshots/31-branch-after-add.png",
    fullPage: false,
  });

  // Remove the "escalate" chip. Cascade: the branch→notify_manager edge that
  // used sourceHandle="escalate" must disappear too — otherwise the canvas
  // keeps a dangling edge and users perceive "removal didn't apply live".
  const escalateRemove = page.locator(
    'span.chip:has-text("escalate") button[aria-label*="escalate"]',
  );
  await escalateRemove.click();
  await page.waitForTimeout(200);
  await expect(branchHandles).toHaveCount(2);
  await expect(allEdges).toHaveCount(baselineEdgeCount - 1);
  await expect(page.locator(".react-flow__edge-textwrapper", { hasText: "escalate" })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "tests/screenshots/32-branch-after-remove.png",
    fullPage: false,
  });
});

test("Delete key removes selected node + cascades its edges", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const allNodes = page.locator(".wv-node");
  const allEdges = page.locator(".react-flow__edge");
  const baselineNodes = await allNodes.count();
  const baselineEdges = await allEdges.count();

  // Select the tool (stripe_lookup) — it sits between input and branch,
  // so deleting it should drop 2 edges (in→tool and tool→branch).
  const tool = page.locator(".wv-node.n-tool").filter({ hasText: "stripe_lookup" });
  await tool.click();
  await page.waitForTimeout(150);

  await page.screenshot({
    path: "tests/screenshots/50-before-delete.png",
    fullPage: false,
  });

  // Press Delete (macOS uses Backspace; xyflow listens to both by default).
  await page.keyboard.press("Delete");
  await page.waitForTimeout(200);

  await expect(allNodes).toHaveCount(baselineNodes - 1);
  await expect(page.locator(".wv-node.n-tool").filter({ hasText: "stripe_lookup" })).toHaveCount(0);
  // stripe_lookup was source/target of 2 edges in the seed.
  await expect(allEdges).toHaveCount(baselineEdges - 2);

  await page.screenshot({
    path: "tests/screenshots/51-after-delete.png",
    fullPage: false,
  });
});

test("Backspace also deletes the selected node (macOS-style)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const branch = page.locator(".wv-node.n-branch").first();
  await branch.click();
  await page.waitForTimeout(150);

  const allNodes = page.locator(".wv-node");
  const before = await allNodes.count();

  await page.keyboard.press("Backspace");
  await page.waitForTimeout(200);

  await expect(allNodes).toHaveCount(before - 1);
  await page.screenshot({
    path: "tests/screenshots/52-after-backspace.png",
    fullPage: false,
  });
});

test("label validation shows error inline", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const agent = page.locator(".wv-node.n-agent").first();
  await agent.click();
  await page.waitForTimeout(150);

  const labelInput = page.locator('input[placeholder="policy_check"]');
  await labelInput.fill("");
  await page.waitForTimeout(100);

  // Input should gain the .err class (red border) and the help text should switch.
  await expect(labelInput).toHaveClass(/err/);
  await expect(page.locator("div.help.err")).toContainText("label");

  await page.screenshot({
    path: "tests/screenshots/40-label-error.png",
    fullPage: false,
  });
});
