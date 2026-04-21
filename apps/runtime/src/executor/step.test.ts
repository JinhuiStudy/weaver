import { describe, expect, it } from "vitest";
import { type AgentRun, executeOneStep, type RunContext } from "./step";

/**
 * step.executeOneStep is the single source of truth for "advance an
 * `agent_runs` row by one node". We test it with pure JS inputs — the real
 * D1 wire-up lives in the Cron handler which calls into this function.
 *
 * State machine (specs/node-types.md + ADR-002):
 *   pending → running (first step picks it up)
 *   running + input node  → running (move to next)
 *   running + output node → complete
 *   running + no next     → complete (graph exhausted)
 *   running + missing node → failed (state.current_node_id broken)
 */

const ctx = (overrides: Partial<RunContext> = {}): RunContext => ({
  nodes: overrides.nodes ?? [],
  edges: overrides.edges ?? [],
  now: overrides.now ?? 1_700_000_000_000,
});

function run(partial: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "r1",
    tool_id: "t",
    tool_version: 1,
    org_id: "o",
    status: "pending",
    input: { order_id: "ord_42" },
    current_node_id: null,
    state: {},
    retry_count: 0,
    trace_id: null,
    created_at: 0,
    updated_at: 0,
    completed_at: null,
    ...partial,
  };
}

describe("executeOneStep · pending → running", () => {
  it("picks up a pending run and sets status=running + current_node_id=first input", () => {
    const result = executeOneStep(
      run({ status: "pending" }),
      ctx({
        nodes: [
          { id: "in", type: "input" },
          { id: "out", type: "output" },
        ],
        edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
      }),
    );
    expect(result.status).toBe("running");
    expect(result.current_node_id).toBe("in");
    expect(result.updated_at).toBeGreaterThan(0);
  });

  it("fails a pending run whose graph has no input node", () => {
    const result = executeOneStep(
      run({ status: "pending" }),
      ctx({
        nodes: [{ id: "out", type: "output" }],
        edges: [],
      }),
    );
    expect(result.status).toBe("failed");
  });
});

describe("executeOneStep · running transitions", () => {
  const graph = ctx({
    nodes: [
      { id: "in", type: "input" },
      { id: "ag", type: "agent" },
      { id: "out", type: "output" },
    ],
    edges: [
      { id: "e1", source: { node_id: "in" }, target: { node_id: "ag" } },
      { id: "e2", source: { node_id: "ag" }, target: { node_id: "out" } },
    ],
  });

  it("advances from input to its successor", () => {
    const r = executeOneStep(run({ status: "running", current_node_id: "in" }), graph);
    expect(r.status).toBe("running");
    expect(r.current_node_id).toBe("ag");
  });

  it("advances from agent to its successor", () => {
    const r = executeOneStep(run({ status: "running", current_node_id: "ag" }), graph);
    expect(r.current_node_id).toBe("out");
  });

  it("completes when it reaches the output node", () => {
    const r = executeOneStep(run({ status: "running", current_node_id: "out" }), graph);
    expect(r.status).toBe("complete");
    expect(r.completed_at).toBeGreaterThan(0);
  });

  it("completes when a running node has no outgoing edge (dead-end)", () => {
    const r = executeOneStep(
      run({ status: "running", current_node_id: "ag" }),
      ctx({
        nodes: [
          { id: "in", type: "input" },
          { id: "ag", type: "agent" },
        ],
        edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "ag" } }],
      }),
    );
    expect(r.status).toBe("complete");
  });

  it("fails when current_node_id no longer exists in the graph", () => {
    const r = executeOneStep(run({ status: "running", current_node_id: "ghost" }), graph);
    expect(r.status).toBe("failed");
  });
});

describe("executeOneStep · immutability", () => {
  it("returns a new object; original run is not mutated", () => {
    const original = run({ status: "pending" });
    const g = ctx({
      nodes: [
        { id: "in", type: "input" },
        { id: "out", type: "output" },
      ],
      edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
    });
    const copy = { ...original };
    executeOneStep(original, g);
    expect(original).toEqual(copy);
  });
});
