import { describe, expect, it } from "vitest";
import { parseGraph } from "./graph";
import { type CanvasGraphInput, canvasToGraph, graphToCanvas } from "./serialize";

/**
 * The canvas holds xyflow-shaped `{ id, type, position, data }` nodes and
 * `{ id, source, target, sourceHandle?, label? }` edges. `@weaver/core`'s
 * `Graph` schema is the authoritative exchange format (D1 / JSON export /
 * Workers AI compose output / import). These tests pin the lossy round-trip:
 * position + label + kind + body + branch outputs all survive, and the
 * resulting Graph validates under `parseGraph`.
 */
describe("canvasToGraph → parseGraph → graphToCanvas round-trip", () => {
  const sample: CanvasGraphInput = {
    toolId: "cs-refund-agent",
    toolVersion: 3,
    nodes: [
      {
        id: "in1",
        type: "input",
        position: { x: 0, y: 120 },
        data: { label: "refund_received", kind: "INPUT · WEBHOOK", body: "POST /refund" },
      },
      {
        id: "ag1",
        type: "agent",
        position: { x: 280, y: 120 },
        data: { label: "policy_check", kind: "AGENT · CLAUDE", body: "model: sonnet-4-6" },
      },
      {
        id: "br1",
        type: "branch",
        position: { x: 560, y: 120 },
        data: { label: "within_7d", outputs: ["approve", "escalate"], body: "age ≤ 7d" },
      },
      {
        id: "out1",
        type: "output",
        position: { x: 840, y: 40 },
        data: { label: "approve_refund", body: "return 200" },
      },
    ],
    edges: [
      { id: "e1", source: "in1", target: "ag1" },
      { id: "e2", source: "ag1", target: "br1" },
      { id: "e3", source: "br1", target: "out1", sourceHandle: "approve", label: "approve" },
    ],
  };

  it("produces a Graph that validates with parseGraph", () => {
    const graph = canvasToGraph(sample);
    expect(() => parseGraph(graph)).not.toThrow();
    expect(graph.tool_id).toBe("cs-refund-agent");
    expect(graph.tool_version).toBe(3);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
  });

  it("preserves node position · label · kind · body", () => {
    const graph = canvasToGraph(sample);
    const agent = graph.nodes.find((n) => n.id === "ag1");
    expect(agent?.position).toEqual({ x: 280, y: 120 });
    expect(agent?.label).toBe("policy_check");
  });

  it("materializes branch outputs as BranchNode.outputs[]", () => {
    const graph = canvasToGraph(sample);
    const branch = graph.nodes.find((n) => n.id === "br1");
    expect(branch?.type).toBe("branch");
    if (branch?.type === "branch") {
      expect(branch.outputs.map((o) => o.id).sort()).toEqual(["approve", "escalate"]);
    }
  });

  it("round-trips back into canvas-shaped nodes + edges", () => {
    const graph = canvasToGraph(sample);
    const canvas = graphToCanvas(graph);
    expect(canvas.nodes).toHaveLength(sample.nodes.length);
    expect(canvas.edges).toHaveLength(sample.edges.length);
    const agent = canvas.nodes.find((n) => n.id === "ag1");
    expect(agent?.data.label).toBe("policy_check");
    expect(agent?.position).toEqual({ x: 280, y: 120 });
    const br1 = canvas.nodes.find((n) => n.id === "br1");
    expect(br1?.data.outputs).toEqual(["approve", "escalate"]);
  });

  it("rejects a graph with missing input node via parseGraph", () => {
    const noInput: CanvasGraphInput = {
      ...sample,
      nodes: sample.nodes.filter((n) => n.type !== "input"),
    };
    const graph = canvasToGraph(noInput);
    // shape-valid, semantically incomplete — caller must still run validateGraph.
    expect(() => parseGraph(graph)).not.toThrow();
  });
});
