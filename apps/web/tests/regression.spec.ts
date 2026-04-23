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

/*
 * Warm the Vite dev server once per spec file so the first test doesn't race
 * against on-demand dep compilation (which can leave an error overlay visible
 * just long enough to block the first click). Dismisses any lingering overlay
 * before the real tests begin.
 */
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto(`/builder/warmup-${Math.random().toString(36).slice(2, 8)}`);
  await page.locator(".react-flow__viewport").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.close();
});

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

/* ── F14: Help modal (? button) ──────────────────────────────────── */

test("Help button opens a modal listing shortcuts · actions · links", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await expect(page.locator('[role="dialog"][aria-label="Help"]')).toHaveCount(0);

  await page.locator('button[title^="Help"]').click();
  const dialog = page.locator('[role="dialog"][aria-label="Help"]');
  await expect(dialog).toBeVisible();

  // Must cover the three main reference areas.
  await expect(dialog.locator("h3", { hasText: /Shortcuts/i })).toBeVisible();
  await expect(dialog.locator("h3", { hasText: /Actions/i })).toBeVisible();
  await expect(dialog.locator("h3", { hasText: /Links/i })).toBeVisible();

  // Each major shortcut must appear somewhere in the modal.
  for (const shortcut of ["⌘K", "⌘S", "⌘Z", "⌘⇧Z", "Delete", "Backspace"]) {
    await expect(dialog).toContainText(shortcut);
  }

  // Link to /design should be present and clickable.
  const designLink = dialog.locator('a[href="/design"]');
  await expect(designLink).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/f14-help-modal.png", fullPage: false });

  // Escape closes it.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await expect(dialog).toHaveCount(0);
});

test("Help · Shortcuts rows render label + chips inline (not vertically stacked)", async ({
  page,
}) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await page.locator('button[title^="Help"]').click();
  const dialog = page.locator('[role="dialog"][aria-label="Help"]');
  await expect(dialog).toBeVisible();

  // Find the "Command palette" row — its label + chip row MUST fit on one line.
  const row = dialog.locator(".help-shortcut-row", { hasText: "Command palette" }).first();
  await expect(row).toBeVisible();

  // Check: label's vertical center and chip's vertical center overlap.
  const geo = await row.evaluate((el) => {
    const label = el.querySelector(".help-shortcut-label") as HTMLElement | null;
    const chips = el.querySelector(".help-shortcut-chips") as HTMLElement | null;
    if (!label || !chips) return { overlap: false };
    const a = label.getBoundingClientRect();
    const b = chips.getBoundingClientRect();
    return {
      overlap: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < 16,
      aTop: a.top,
      bTop: b.top,
    };
  });
  expect(geo.overlap).toBe(true);
});

test("? key also opens the Help modal (keyboard discovery)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // Focus off the inspector so the key isn't captured by an input.
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Shift+/"); // "?" in most US/KR layouts
  await page.waitForTimeout(120);
  await expect(page.locator('[role="dialog"][aria-label="Help"]')).toBeVisible();
});

/* ── F18: Run button wires /api/runs + navigates to trace viewer ── */

test("Run · POST /api/runs → navigate to /tools/:id/runs/:runId", async ({ page }) => {
  // Mock the runtime. Capture the request body so we can assert.
  let lastBody: unknown = null;
  await page.route("**/api/runs", async (route) => {
    lastBody = await route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "run-mocked-01", status: "pending", tool_id: "mocked" }),
    });
  });

  const id = newToolId();
  await gotoBuilder(page, id);

  await page.locator('button:has-text("Run")').click();
  await page.waitForURL(/\/tools\/.*\/runs\/run-mocked-01$/, { timeout: 5000 });

  // Request body carried our toolId.
  expect((lastBody as { tool_id?: string })?.tool_id).toBe(id);

  // Landed on trace viewer placeholder.
  await expect(page.locator("h1", { hasText: /Trace/i })).toBeVisible();
  await expect(page.locator("text=run-mocked-01").first()).toBeVisible();
});

/* ── F17: Undo / Redo buttons have visible text labels ──────────── */

test("Undo / Redo header buttons show their text label (not icon-only)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // Button labels should be discoverable without hovering for a title tooltip.
  await expect(page.locator('button[aria-label^="Undo"]', { hasText: /Undo/ })).toBeVisible();
  await expect(page.locator('button[aria-label^="Redo"]', { hasText: /Redo/ })).toBeVisible();

  await page.screenshot({
    path: "tests/screenshots/f17-header-buttons.png",
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 60 },
  });
});

/* ── F21: Inspector Agent-specific fields ──────────────────────── */

test("Inspector · Agent 선택 시 model · system_prompt · user_prompt · temperature 편집 가능", async ({
  page,
}) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  const agent = page.locator(".wv-node.n-agent").first();
  await agent.click();
  await page.waitForTimeout(100);

  // Agent-specific fields only visible on agent selection.
  const modelSelect = page.locator('select[aria-label="Agent model"]');
  const systemPrompt = page.locator('textarea[aria-label="System prompt"]');
  const userPrompt = page.locator('textarea[aria-label="User prompt"]');
  const tempSlider = page.locator('input[aria-label="Temperature"]');

  await expect(modelSelect).toBeVisible();
  await expect(systemPrompt).toBeVisible();
  await expect(userPrompt).toBeVisible();
  await expect(tempSlider).toBeVisible();

  // Edit + blur → store picks up the change.
  await modelSelect.selectOption("claude-sonnet-4-6");
  await systemPrompt.fill("You are a refund-policy checker.");
  await systemPrompt.blur();
  await userPrompt.fill("Check {{ input.order_id }}");
  await userPrompt.blur();
  await tempSlider.fill("0.7");
  await page.waitForTimeout(200);

  const probe = await page.evaluate(() => {
    const s = (window as unknown as { __canvas: { getState: () => unknown } }).__canvas.getState();
    const state = s as { nodes: { type?: string; data?: Record<string, unknown> }[] };
    const ag = state.nodes.find((n) => n.type === "agent");
    return ag?.data;
  });
  expect(probe?.model).toBe("claude-sonnet-4-6");
  expect(probe?.system_prompt).toContain("refund-policy");
  expect(probe?.user_prompt).toContain("{{ input.order_id }}");
  expect(Number(probe?.temperature)).toBeCloseTo(0.7, 2);

  await page.screenshot({
    path: "tests/screenshots/f21-inspector-agent.png",
    fullPage: false,
  });
});

test("Inspector · non-agent 노드에는 agent-only 필드 없음", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await page.locator(".wv-node.n-tool").first().click();
  await page.waitForTimeout(100);

  await expect(page.locator('select[aria-label="Agent model"]')).toHaveCount(0);
  await expect(page.locator('textarea[aria-label="System prompt"]')).toHaveCount(0);
});

/* ── F15: Compose header button opens palette in compose mode directly ── */

test("Compose button skips the commands list and opens compose mode", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // Click the header Compose button (not ⌘K).
  await page.locator('button[title^="Compose"], button:has-text("Compose")').first().click();
  await page.waitForTimeout(100);

  const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
  await expect(dialog).toBeVisible();

  // compose mode shows the prompt textarea immediately. commands-list input
  // is NOT present.
  await expect(page.locator('textarea[aria-label="Compose prompt"]')).toBeVisible();
  await expect(
    page.locator('[role="dialog"][aria-label="Command palette"] input[placeholder*="검색"]'),
  ).toHaveCount(0);
});

test("⌘K still opens the palette in commands mode (not compose)", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(100);
  await expect(
    page.locator('[role="dialog"][aria-label="Command palette"] input[placeholder*="검색"]'),
  ).toBeVisible();
  await expect(page.locator('textarea[aria-label="Compose prompt"]')).toHaveCount(0);
});

/* ── F13: polish — palette animation · node icons · /runs/:runId ───── */

test("palette backdrop has the fade-in animation applied", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  await page.keyboard.press("Meta+k");
  await page.locator('[role="dialog"][aria-label="Command palette"]').waitFor();

  const animationName = await page
    .locator('[role="dialog"][aria-label="Command palette"]')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animationName).not.toBe("none");
});

test("each node type renders a kind-icon (lucide) next to the kicker", async ({ page }) => {
  const id = newToolId();
  await gotoBuilder(page, id);

  // The seed includes one node of every type. The node header should carry
  // an <svg> (rendered by lucide-react) identifiable via the .kind-icon hook.
  for (const type of ["input", "tool", "agent", "branch", "output"] as const) {
    const node = page.locator(`.wv-node.n-${type}`).first();
    await expect(node.locator(".kind-icon svg")).toBeVisible();
  }
  await page.screenshot({
    path: "tests/screenshots/f13-node-icons.png",
    fullPage: false,
  });
});

test("/tools/:id/runs/:runId renders a trace viewer placeholder", async ({ page }) => {
  await page.goto("/tools/demo/runs/01HXY");
  await expect(page.locator("h1", { hasText: /Trace/i })).toBeVisible();
  await expect(page.locator("text=01HXY").first()).toBeVisible();
  await page.screenshot({
    path: "tests/screenshots/f13-trace-placeholder.png",
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
