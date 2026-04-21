import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Cron handler integration: insert rows directly, invoke the scheduled()
 * export, and verify D1 reflects one-step advances. No real Workers AI here
 * — the graph we seed only has input/output nodes, so executor/step can run
 * the state machine without hitting runAgent.
 */

async function seedRun(params: {
  id: string;
  status: string;
  current: string | null;
  graph: unknown;
}) {
  await env.DB.prepare(
    `INSERT INTO agent_runs
      (id, tool_id, tool_version, org_id, status, input, state,
       current_node_id, graph_json, created_at, updated_at,
       retry_count, cost_usd_micro)
     VALUES (?, 'demo', 1, 'test', ?, '{}', '{}', ?, ?, ?, ?, 0, 0)`,
  )
    .bind(
      params.id,
      params.status,
      params.current,
      JSON.stringify(params.graph),
      Date.now(),
      Date.now(),
    )
    .run();
}

const linearGraph = {
  nodes: [
    { id: "in", type: "input" },
    { id: "out", type: "output" },
  ],
  edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
};

describe("Cron scheduled() · D1 integration", () => {
  it("advances pending rows — pending → running → complete", async () => {
    await seedRun({
      id: "r-live-1",
      status: "pending",
      current: null,
      graph: linearGraph,
    });

    // Tick 1: pending → running(in).
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    let row = await env.DB.prepare(
      "SELECT status, current_node_id FROM agent_runs WHERE id = ?",
    )
      .bind("r-live-1")
      .first<{ status: string; current_node_id: string | null }>();
    expect(row?.status).toBe("running");
    expect(row?.current_node_id).toBe("in");

    // Tick 2: running(in) → running(out) via the only outgoing edge.
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    row = await env.DB.prepare(
      "SELECT status, current_node_id FROM agent_runs WHERE id = ?",
    )
      .bind("r-live-1")
      .first<{ status: string; current_node_id: string | null }>();
    expect(row?.current_node_id).toBe("out");

    // Tick 3: output node → complete.
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    row = await env.DB.prepare(
      "SELECT status, current_node_id, completed_at FROM agent_runs WHERE id = ?",
    )
      .bind("r-live-1")
      .first<{ status: string; current_node_id: string | null; completed_at: number | null }>();
    expect(row?.status).toBe("complete");
    expect(row?.completed_at).toBeGreaterThan(0);
  });

  it("leaves complete / failed rows alone (no spurious updates)", async () => {
    await seedRun({
      id: "r-done",
      status: "complete",
      current: "out",
      graph: linearGraph,
    });
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    const row = await env.DB.prepare("SELECT status FROM agent_runs WHERE id = ?")
      .bind("r-done")
      .first<{ status: string }>();
    expect(row?.status).toBe("complete");
  });

  it("fails a pending row whose graph has no input node", async () => {
    await seedRun({
      id: "r-bad",
      status: "pending",
      current: null,
      graph: { nodes: [{ id: "out", type: "output" }], edges: [] },
    });
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    const row = await env.DB.prepare("SELECT status FROM agent_runs WHERE id = ?")
      .bind("r-bad")
      .first<{ status: string }>();
    expect(row?.status).toBe("failed");
  });
});
