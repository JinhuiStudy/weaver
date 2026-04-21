import { expect, type Page, test } from "@playwright/test";

/**
 * Regression test suite — scenarios outside the happy paths in builder.spec.ts.
 * Goal: every feature (F1 … F9) gets at least one stress / negative / edge case
 * in here, with a screenshot where a visual state matters.
 */

function newToolId() {
  return `pwreg-${Math.random().toString(36).slice(2, 10)}`;
}

async function gotoBuilder(page: Page, id: string) {
  await page.goto(`/builder/${id}`);
  await page.locator(".react-flow__viewport").waitFor();
  await page.locator(".wv-node").first().waitFor();
  await page.waitForTimeout(400);
}

/* ── R6: delete via inspector · undo exhaustion · palette jump ─────── */

test("delete via Inspector button matches Delete key (cascade edges)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);
  const allNodes = page.locator(".wv-node");
  const allEdges = page.locator(".react-flow__edge");
  const baseNodes = await allNodes.count();
  const baseEdges = await allEdges.count();

  const tool = page.locator(".wv-node.n-tool").filter({ hasText: "stripe_lookup" });
  await tool.click();
  await page.waitForTimeout(100);

  await page.locator("button", { hasText: "노드 삭제" }).click();
  await page.waitForTimeout(200);

  await expect(allNodes).toHaveCount(baseNodes - 1);
  await expect(allEdges).toHaveCount(baseEdges - 2);
});

test("undo to empty history is a no-op (no crash)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const before = await page.locator(".wv-node").count();
  // Click canvas to take focus.
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(20);
  }
  await expect(page.locator(".wv-node")).toHaveCount(before);
});

test("palette · Add agent twice places the two new nodes without overlap", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  async function addViaPalette(term: string) {
    await page.keyboard.press("Meta+k");
    await page
      .locator('[role="dialog"][aria-label="Command palette"] input')
      .waitFor({ state: "visible" });
    await page.locator('[role="dialog"][aria-label="Command palette"] input').fill(term);
    await page.locator('[role="dialog"][aria-label="Command palette"] input').press("Enter");
    await page.waitForTimeout(200);
  }

  await addViaPalette("add agent node");
  await addViaPalette("add agent node");

  // Count agents via the store (authoritative) to sidestep xyflow viewport
  // clipping.
  const agentCount = await page.evaluate(() => {
    const s = (window as unknown as { __canvas?: { getState: () => unknown } }).__canvas;
    if (!s) return -1;
    const state = s.getState() as {
      nodes: { type?: string; data?: { label?: string } }[];
    };
    return state.nodes.filter((n) => n.type === "agent" && n.data?.label === "new_agent").length;
  });
  expect(agentCount).toBe(2);

  // Get positions from the store too — DOM bounding boxes may be clipped.
  const positions = await page.evaluate(() => {
    const s = (window as unknown as { __canvas: { getState: () => unknown } }).__canvas;
    const state = s.getState() as {
      nodes: { type?: string; data?: { label?: string }; position: { x: number; y: number } }[];
    };
    return state.nodes
      .filter((n) => n.type === "agent" && n.data?.label === "new_agent")
      .map((n) => n.position);
  });
  expect(positions).toHaveLength(2);
  const [p1, p2] = positions;
  if (!p1 || !p2) throw new Error("expected two positions");

  const NODE_W = 240;
  const NODE_H = 120;
  const overlap = Math.abs(p1.x - p2.x) < NODE_W && Math.abs(p1.y - p2.y) < NODE_H;
  expect(overlap).toBe(false);
});

/* ── F10: Compose with AI via /api/compose ───────────────────────── */

test("Compose with AI · prompt submit applies the runtime diff to the canvas", async ({ page }) => {
  // Canned /api/compose response — stand in for both the offline stub and the
  // Workers AI path. The shape matches the real endpoint
  // (see apps/runtime/src/index.ts).
  await page.route("**/api/compose", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        intent: { ops: [{ kind: "add_node", nodeType: "agent" }] },
        canvas: { nodes: [], edges: [] }, // not consumed by the web side
        diff: {
          addedNodes: [
            {
              id: "compose-1",
              type: "agent",
              position: { x: 420, y: 420 },
              data: { label: "ai_generated" },
            },
          ],
          addedEdges: [],
        },
      }),
    });
  });

  const id = newToolId();
  await gotoBuilder(page, id);

  const baselineAgents = await page.locator(".wv-node.n-agent").count();

  await page.keyboard.press("Meta+k");
  const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
  await expect(dialog).toBeVisible();

  // Select the Compose command — query narrows to it.
  await dialog.locator("input").fill("compose ai");
  await dialog.locator("input").press("Enter");
  await page.waitForTimeout(150);

  // Palette should switch to "Compose" mode: textarea + Submit button.
  const composeTextarea = page.locator('textarea[aria-label="Compose prompt"]');
  await expect(composeTextarea).toBeVisible();
  await composeTextarea.fill("add an agent node");
  await page.locator('button[aria-label="Submit compose prompt"]').click();
  await page.waitForTimeout(250);

  // Canvas picks up the new agent from the mocked diff.
  await expect(page.locator(".wv-node.n-agent").filter({ hasText: "ai_generated" })).toHaveCount(1);
  await expect(page.locator(".wv-node.n-agent")).toHaveCount(baselineAgents + 1);

  await page.screenshot({
    path: "tests/screenshots/f10-compose-applied.png",
    fullPage: false,
  });
});

test("palette jump-to-node highlights it in the inspector", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await page.keyboard.press("Meta+k");
  const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
  await expect(dialog).toBeVisible();

  await dialog.locator("input").fill("policy_check");
  // The dynamic Jump-to command should appear.
  await dialog.locator("input").press("Enter");
  await page.waitForTimeout(150);

  // Inspector label input reflects selection.
  await expect(page.locator('input[placeholder="policy_check"]')).toHaveValue("policy_check");
});

/* ── R7: import invalid JSON · round-trip save→import ─────────────── */

test("Import · invalid JSON does not crash the app or change canvas", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);
  const before = await page.locator(".wv-node").count();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("button", { hasText: "Import" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not really json"),
  });

  // 200ms should be enough for any async error path to complete.
  await page.waitForTimeout(300);
  await expect(page.locator(".wv-node")).toHaveCount(before);
});

test("Import · structurally wrong Graph is rejected (canvas unchanged)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);
  const before = await page.locator(".wv-node").count();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("button", { hasText: "Import" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "bad.weaver.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 99, mystery: true })),
  });
  await page.waitForTimeout(300);
  await expect(page.locator(".wv-node")).toHaveCount(before);
});

test("Save → Import round-trip · exported JSON reloads onto the same canvas", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const beforeNodes = await page.locator(".wv-node").count();
  const beforeEdges = await page.locator(".react-flow__edge").count();

  // 1. Save — capture the JSON.
  const downloadPromise = page.waitForEvent("download");
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Meta+s");
  const download = await downloadPromise;
  const path = await download.path();
  const content = await (await import("node:fs/promises")).readFile(path, "utf8");

  // 2. Change the canvas a bit so the round-trip is observable.
  await page.locator(".wv-node.n-agent").first().click();
  await page.waitForTimeout(100);
  await page.locator('input[placeholder="policy_check"]').fill("temporarily_renamed");
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(100);
  await expect(
    page.locator(".wv-node.n-agent .label", { hasText: /^temporarily_renamed$/ }),
  ).toBeVisible();

  // 3. Import the captured JSON — should restore the original labels.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("button", { hasText: "Import" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "roundtrip.weaver.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await page.waitForTimeout(300);

  await expect(page.locator(".wv-node")).toHaveCount(beforeNodes);
  await expect(page.locator(".react-flow__edge")).toHaveCount(beforeEdges);
  await expect(
    page.locator(".wv-node.n-agent .label", { hasText: /^policy_check$/ }),
  ).toBeVisible();
});

/* ── R8: Yjs reload persistence ───────────────────────────────────── */

test("page.reload() preserves the canvas (Yjs + IndexedDB)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // Mutate: add a node via the palette so there's something custom to persist.
  await page.keyboard.press("Meta+k");
  const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
  await dialog.locator("input").fill("add an input node");
  await dialog.locator("input").press("Enter");
  await page.waitForTimeout(300); // let the debounced Yjs flush settle

  const beforeNodes = await page.locator(".wv-node").count();
  await page.reload();
  await page.locator(".wv-node").first().waitFor();
  await page.waitForTimeout(500);

  await expect(page.locator(".wv-node")).toHaveCount(beforeNodes);
});

test("distinct tool_ids don't leak canvas state into each other", async ({ page }) => {
  const a = newToolId();
  const b = newToolId();
  await gotoBuilder(page, a);
  const aCount = await page.locator(".wv-node").count();

  // Delete a node in A.
  await page.locator(".wv-node.n-tool").first().click();
  await page.waitForTimeout(50);
  await page.keyboard.press("Backspace");
  // useCanvasPersistence debounces Zustand → Y.Doc writes by 300 ms.
  // Wait past that so the IndexedDB put completes before we navigate away.
  await page.waitForTimeout(600);
  const aAfterDelete = await page.locator(".wv-node").count();
  expect(aAfterDelete).toBe(aCount - 1);

  // Switch to B — it should be seeded fresh, unaffected by A's mutation.
  await gotoBuilder(page, b);
  await expect(page.locator(".wv-node")).toHaveCount(aCount);

  // Back to A — its local mutation should still be there (IndexedDB).
  await gotoBuilder(page, a);
  await expect(page.locator(".wv-node")).toHaveCount(aAfterDelete);
});

/* ── R9: /design renders every section ────────────────────────────── */

test("/design page · 10 sections all render with a heading", async ({ page }) => {
  await page.goto("/design");
  await page.locator("h1").first().waitFor();

  const expected = [
    "Color",
    "Typography",
    "Nodes · 5 types",
    "Node states",
    "Buttons",
    "Inputs · Toggles",
    "Badges · Chips · Keyboard",
    "Tabs · Menus · Tooltips",
    "Cards · Panels",
    "Empty · Loading · Toast",
  ];
  for (const title of expected) {
    await expect(page.locator("h2", { hasText: title })).toBeVisible();
  }

  await page.screenshot({
    path: "tests/screenshots/r9-design-sections.png",
    fullPage: true,
  });
});

/* ── R10: Node visual states ──────────────────────────────────────── */

test("/design · node-states section includes all 8 variants", async ({ page }) => {
  await page.goto("/design#node-states");
  await page.locator("#node-states").waitFor();
  await page.waitForTimeout(200);

  // Each tile in the state matrix carries the state name as footer text.
  const states = ["default", "hover", "selected", "running", "error", "warn", "disabled", "ok"];
  for (const state of states) {
    await expect(
      page
        .locator("#node-states .state", { hasText: state })
        .or(page.locator("#node-states", { hasText: new RegExp(state, "i") })),
    ).toBeVisible();
  }

  await page.screenshot({
    path: "tests/screenshots/r10-node-states.png",
    fullPage: false,
    clip: { x: 240, y: 0, width: 1040, height: 900 },
  });
});

test("running node renders the conic-gradient ring (CSS class applied)", async ({ page }) => {
  await page.goto("/design#node-states");
  await page.locator("#node-states").waitFor();
  await page.waitForTimeout(200);

  // One of the displayed WvNode mocks has state=running → wv-node.st-running.
  await expect(page.locator(".wv-node.st-running")).toHaveCount(1);
  const bg = await page
    .locator(".wv-node.st-running")
    .first()
    .evaluate((el) => getComputedStyle(el).borderColor);
  // border-color should resolve to the indigo brand token's rgb (#6366F1).
  expect(bg).toMatch(/99,\s*102,\s*241/);
});
