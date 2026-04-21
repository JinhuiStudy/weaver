import { describe, expect, it } from "vitest";
import { findCycle, findIsolatedNodes, type Graph, parseGraph, validateGraph } from "./graph.ts";
import type { Node } from "./node.ts";

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

const baseGraph = (overrides: Partial<Graph> = {}): Graph => ({
  version: 1,
  tool_id: "demo",
  tool_version: 1,
  nodes: [nodeOf("in1", "input"), nodeOf("out1", "output")],
  edges: [
    {
      id: "e1",
      source: { node_id: "in1" },
      target: { node_id: "out1" },
    },
  ],
  ...overrides,
});

describe("parseGraph", () => {
  it("parses a minimal input→output graph", () => {
    const g = parseGraph(baseGraph());
    expect(g.nodes).toHaveLength(2);
  });
});

describe("validateGraph", () => {
  it("accepts a minimal valid graph", () => {
    expect(validateGraph(baseGraph())).toEqual({ ok: true });
  });

  it("flags missing input", () => {
    const g = baseGraph({
      nodes: [nodeOf("out1", "output")],
      edges: [],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.kind)).toContain("no_input");
    }
  });

  it("flags missing output", () => {
    const g = baseGraph({
      nodes: [nodeOf("in1", "input")],
      edges: [],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.kind)).toContain("no_output");
    }
  });

  it("flags duplicate node ids", () => {
    const g = baseGraph({
      nodes: [nodeOf("x", "input"), nodeOf("x", "output")],
      edges: [{ id: "e", source: { node_id: "x" }, target: { node_id: "x" } }],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
  });

  it("flags isolated nodes", () => {
    const g = baseGraph({
      nodes: [nodeOf("in1", "input"), nodeOf("ag1", "agent"), nodeOf("out1", "output")],
      edges: [{ id: "e1", source: { node_id: "in1" }, target: { node_id: "out1" } }],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.kind === "isolated_node")).toBe(true);
    }
  });

  it("flags cycles", () => {
    const g = baseGraph({
      nodes: [
        nodeOf("in1", "input"),
        nodeOf("ag1", "agent"),
        nodeOf("ag2", "agent"),
        nodeOf("out1", "output"),
      ],
      edges: [
        { id: "e1", source: { node_id: "in1" }, target: { node_id: "ag1" } },
        { id: "e2", source: { node_id: "ag1" }, target: { node_id: "ag2" } },
        { id: "e3", source: { node_id: "ag2" }, target: { node_id: "ag1" } },
        { id: "e4", source: { node_id: "ag2" }, target: { node_id: "out1" } },
      ],
    });
    const result = validateGraph(g);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.kind === "cycle")).toBe(true);
    }
  });
});

describe("findCycle", () => {
  it("returns null for a DAG", () => {
    expect(findCycle(baseGraph())).toBeNull();
  });

  it("detects a two-node cycle", () => {
    const g = baseGraph({
      nodes: [nodeOf("a", "agent"), nodeOf("b", "agent")],
      edges: [
        { id: "e1", source: { node_id: "a" }, target: { node_id: "b" } },
        { id: "e2", source: { node_id: "b" }, target: { node_id: "a" } },
      ],
    });
    const cycle = findCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("findIsolatedNodes", () => {
  it("returns empty for fully connected graph", () => {
    expect(findIsolatedNodes(baseGraph())).toEqual([]);
  });

  it("flags nodes disconnected from input", () => {
    const g = baseGraph({
      nodes: [nodeOf("in1", "input"), nodeOf("lonely", "agent"), nodeOf("out1", "output")],
      edges: [{ id: "e1", source: { node_id: "in1" }, target: { node_id: "out1" } }],
    });
    expect(findIsolatedNodes(g)).toContain("lonely");
  });
});
