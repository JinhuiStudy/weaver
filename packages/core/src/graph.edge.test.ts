import { describe, expect, it } from "vitest";
import { findCycle, findIsolatedNodes, type Graph, validateGraph } from "./graph";
import type { Node } from "./node";

const nodeOf = (id: string, type: Node["type"]): Node => {
  const base = {
    id,
    position: { x: 0, y: 0 },
    label: id,
    version: 1,
  } as const;
  switch (type) {
    case "input":
      return { ...base, type, trigger: { kind: "manual" } };
    case "agent":
      return {
        ...base,
        type,
        model: "claude",
        system_prompt: "",
        user_prompt: "",
        tool_choice: "auto",
        use_prompt_cache: false,
      };
    case "tool":
      return { ...base, type, tool_id: "http", input_mapping: {}, output_variable: "r" };
    case "branch":
      return {
        ...base,
        type,
        condition_kind: "expression",
        expression: "x",
        outputs: [{ id: "y", label: "y" }],
      };
    case "output":
      return { ...base, type, response_kind: { kind: "return_value" } };
  }
};

const graph = (overrides: Partial<Graph> = {}): Graph => ({
  version: 1,
  tool_id: "t",
  tool_version: 1,
  nodes: [],
  edges: [],
  ...overrides,
});

describe("validateGraph · negative regression cases", () => {
  it("flags an edge whose target node doesn't exist", () => {
    const g = graph({
      nodes: [nodeOf("in", "input"), nodeOf("out", "output")],
      edges: [{ id: "bad", source: { node_id: "in" }, target: { node_id: "ghost" } }],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.kind === "edge")).toBe(true);
    }
  });

  it("flags an edge whose source node doesn't exist", () => {
    const g = graph({
      nodes: [nodeOf("in", "input"), nodeOf("out", "output")],
      edges: [{ id: "bad", source: { node_id: "ghost" }, target: { node_id: "out" } }],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
  });

  it("accepts multiple input nodes (fan-in is legal)", () => {
    const g = graph({
      nodes: [nodeOf("in1", "input"), nodeOf("in2", "input"), nodeOf("out", "output")],
      edges: [
        { id: "e1", source: { node_id: "in1" }, target: { node_id: "out" } },
        { id: "e2", source: { node_id: "in2" }, target: { node_id: "out" } },
      ],
    });
    expect(validateGraph(g)).toEqual({ ok: true });
  });

  it("accepts multiple output nodes (fan-out is legal)", () => {
    const g = graph({
      nodes: [nodeOf("in", "input"), nodeOf("out1", "output"), nodeOf("out2", "output")],
      edges: [
        { id: "e1", source: { node_id: "in" }, target: { node_id: "out1" } },
        { id: "e2", source: { node_id: "in" }, target: { node_id: "out2" } },
      ],
    });
    expect(validateGraph(g)).toEqual({ ok: true });
  });

  it("flags a 3-node cycle", () => {
    const g = graph({
      nodes: [
        nodeOf("in", "input"),
        nodeOf("a", "agent"),
        nodeOf("b", "agent"),
        nodeOf("c", "agent"),
        nodeOf("out", "output"),
      ],
      edges: [
        { id: "e1", source: { node_id: "in" }, target: { node_id: "a" } },
        { id: "e2", source: { node_id: "a" }, target: { node_id: "b" } },
        { id: "e3", source: { node_id: "b" }, target: { node_id: "c" } },
        { id: "e4", source: { node_id: "c" }, target: { node_id: "a" } },
        { id: "e5", source: { node_id: "c" }, target: { node_id: "out" } },
      ],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
  });

  it("flags duplicate edge ids", () => {
    const g = graph({
      nodes: [nodeOf("in", "input"), nodeOf("out", "output")],
      edges: [
        { id: "dup", source: { node_id: "in" }, target: { node_id: "out" } },
        { id: "dup", source: { node_id: "in" }, target: { node_id: "out" } },
      ],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.kind === "duplicate_edge_id")).toBe(true);
    }
  });
});

describe("findIsolatedNodes · deeper topologies", () => {
  it("returns empty for a linear input→agent→tool→output graph", () => {
    const g = graph({
      nodes: [
        nodeOf("in", "input"),
        nodeOf("ag", "agent"),
        nodeOf("tool", "tool"),
        nodeOf("out", "output"),
      ],
      edges: [
        { id: "e1", source: { node_id: "in" }, target: { node_id: "ag" } },
        { id: "e2", source: { node_id: "ag" }, target: { node_id: "tool" } },
        { id: "e3", source: { node_id: "tool" }, target: { node_id: "out" } },
      ],
    });
    expect(findIsolatedNodes(g)).toEqual([]);
  });

  it("flags an entire disconnected subgraph", () => {
    const g = graph({
      nodes: [
        nodeOf("in", "input"),
        nodeOf("out", "output"),
        nodeOf("island_a", "agent"),
        nodeOf("island_b", "agent"),
      ],
      edges: [
        { id: "e1", source: { node_id: "in" }, target: { node_id: "out" } },
        { id: "e2", source: { node_id: "island_a" }, target: { node_id: "island_b" } },
      ],
    });
    const isolated = findIsolatedNodes(g);
    expect(isolated).toContain("island_a");
    expect(isolated).toContain("island_b");
  });
});

describe("findCycle · null on DAG, path on cycle", () => {
  it("returns null on a diamond (input → {a,b} → out)", () => {
    const g = graph({
      nodes: [
        nodeOf("in", "input"),
        nodeOf("a", "agent"),
        nodeOf("b", "agent"),
        nodeOf("out", "output"),
      ],
      edges: [
        { id: "e1", source: { node_id: "in" }, target: { node_id: "a" } },
        { id: "e2", source: { node_id: "in" }, target: { node_id: "b" } },
        { id: "e3", source: { node_id: "a" }, target: { node_id: "out" } },
        { id: "e4", source: { node_id: "b" }, target: { node_id: "out" } },
      ],
    });
    expect(findCycle(g)).toBeNull();
  });

  it("returns a non-trivial path for a big cycle", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const g = graph({
      nodes: ids.map((id) => nodeOf(id, "agent")),
      edges: [
        { id: "e1", source: { node_id: "a" }, target: { node_id: "b" } },
        { id: "e2", source: { node_id: "b" }, target: { node_id: "c" } },
        { id: "e3", source: { node_id: "c" }, target: { node_id: "d" } },
        { id: "e4", source: { node_id: "d" }, target: { node_id: "e" } },
        { id: "e5", source: { node_id: "e" }, target: { node_id: "a" } },
      ],
    });
    const cycle = findCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThanOrEqual(2);
  });
});
