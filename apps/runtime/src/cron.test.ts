import { describe, expect, it } from "vitest";
import { processPendingRuns } from "./cron";
import type { AgentRun, StepEdge, StepNode } from "./executor/step";

/**
 * processPendingRuns()는 Cron의 core 로직을 순수 함수화한 것.
 * 입력: pending run 배열 + graph + now.
 * 출력: 각 run을 executeOneStep으로 1 스텝 진행한 결과 + 사이드 정보.
 *
 * 실제 Cron handler는 D1에서 SELECT → 이 함수 호출 → UPDATE. 테스트는
 * 순수함수 단에서만 검증.
 */

const linearGraph = {
  nodes: [
    { id: "in", type: "input" },
    { id: "ag", type: "agent" },
    { id: "out", type: "output" },
  ] satisfies StepNode[],
  edges: [
    { id: "e1", source: { node_id: "in" }, target: { node_id: "ag" } },
    { id: "e2", source: { node_id: "ag" }, target: { node_id: "out" } },
  ] satisfies StepEdge[],
};

const make = (id: string, partial: Partial<AgentRun> = {}): AgentRun => ({
  id,
  tool_id: "demo",
  tool_version: 1,
  org_id: "o",
  status: "pending",
  input: {},
  current_node_id: null,
  state: {},
  retry_count: 0,
  trace_id: null,
  created_at: 0,
  updated_at: 0,
  completed_at: null,
  ...partial,
});

describe("processPendingRuns", () => {
  it("advances every pending run by exactly one step", () => {
    const runs: AgentRun[] = [
      make("r1", { status: "pending" }),
      make("r2", { status: "running", current_node_id: "in" }),
      make("r3", { status: "running", current_node_id: "ag" }),
    ];
    const result = processPendingRuns({ runs, graph: linearGraph, now: 2_000 });
    expect(result.updated).toHaveLength(3);
    expect(result.updated[0]?.status).toBe("running");
    expect(result.updated[0]?.current_node_id).toBe("in");
    expect(result.updated[1]?.current_node_id).toBe("ag");
    expect(result.updated[2]?.current_node_id).toBe("out");
  });

  it("skips terminal runs (complete / failed)", () => {
    const runs: AgentRun[] = [
      make("done", { status: "complete", completed_at: 10 }),
      make("bad", { status: "failed" }),
      make("live", { status: "running", current_node_id: "in" }),
    ];
    const result = processPendingRuns({ runs, graph: linearGraph, now: 2_000 });
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0]?.id).toBe("live");
  });

  it("reports which runs have more work (next_step_at) vs completed", () => {
    const runs: AgentRun[] = [
      make("r1", { status: "pending" }), // becomes running
      make("r2", { status: "running", current_node_id: "out" }), // completes this step
    ];
    const result = processPendingRuns({ runs, graph: linearGraph, now: 2_000 });
    const byId = new Map(result.updated.map((r) => [r.id, r]));
    expect(byId.get("r1")?.status).toBe("running");
    expect(byId.get("r2")?.status).toBe("complete");
    expect(result.stillPending.map((r) => r.id)).toEqual(["r1"]);
    expect(result.justCompleted.map((r) => r.id)).toEqual(["r2"]);
  });

  it("processes up to N runs (pickup limit)", () => {
    const runs: AgentRun[] = Array.from({ length: 20 }, (_, i) =>
      make(`r${i}`, { status: "pending" }),
    );
    const result = processPendingRuns({
      runs,
      graph: linearGraph,
      now: 1,
      limit: 5,
    });
    expect(result.updated).toHaveLength(5);
  });
});
