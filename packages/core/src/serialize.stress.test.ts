import { describe, expect, it } from "vitest";
import { parseGraph } from "./graph";
import { type CanvasGraphInput, canvasToGraph, graphToCanvas } from "./serialize";

/**
 * Stress the serializer on edge-of-support inputs: empty canvases, a large
 * synthetic graph, and a double round-trip (canvas → graph → canvas → graph).
 * The second round-trip should be a no-op structurally — any drift indicates
 * information loss we should track explicitly.
 */
describe("canvasToGraph · stress", () => {
  it("empty canvas produces a parseable Graph with zero nodes/edges", () => {
    const g = canvasToGraph({ toolId: "empty", toolVersion: 0, nodes: [], edges: [] });
    expect(() => parseGraph(g)).not.toThrow();
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });

  it("handles 500 nodes + 499 edges in under 100 ms", () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `n${i}`,
      type:
        i === 0
          ? ("input" as const)
          : i === 499
            ? ("output" as const)
            : ("agent" as const),
      position: { x: i * 20, y: 0 },
      data: { label: `n${i}` },
    }));
    const edges = Array.from({ length: 499 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    const t0 = performance.now();
    const g = canvasToGraph({ toolId: "big", toolVersion: 1, nodes, edges });
    const dt = performance.now() - t0;
    expect(() => parseGraph(g)).not.toThrow();
    expect(g.nodes).toHaveLength(500);
    expect(dt).toBeLessThan(100);
  });

  it("double round-trip preserves label + position + branch outputs", () => {
    const sample: CanvasGraphInput = {
      toolId: "rt",
      toolVersion: 2,
      nodes: [
        {
          id: "in1",
          type: "input",
          position: { x: 0, y: 0 },
          data: { label: "hook" },
        },
        {
          id: "br1",
          type: "branch",
          position: { x: 200, y: 100 },
          data: { label: "split", outputs: ["a", "b", "c"], body: "x > 0" },
        },
        {
          id: "out1",
          type: "output",
          position: { x: 400, y: 0 },
          data: { label: "done" },
        },
      ],
      edges: [
        { id: "e1", source: "in1", target: "br1" },
        { id: "e2", source: "br1", target: "out1", sourceHandle: "a" },
      ],
    };

    const g1 = canvasToGraph(sample);
    const c1 = graphToCanvas(g1);
    const g2 = canvasToGraph({
      toolId: g1.tool_id,
      toolVersion: g1.tool_version,
      nodes: c1.nodes,
      edges: c1.edges,
    });

    expect(g2.nodes).toHaveLength(g1.nodes.length);
    const br = g2.nodes.find((n) => n.id === "br1");
    expect(br?.type).toBe("branch");
    if (br?.type === "branch") {
      expect(br.outputs.map((o) => o.id)).toEqual(["a", "b", "c"]);
    }
    const input = g2.nodes.find((n) => n.id === "in1");
    expect(input?.label).toBe("hook");
    expect(input?.position).toEqual({ x: 0, y: 0 });
  });

  it("round-trip preserves branch sourceHandle references", () => {
    const input: CanvasGraphInput = {
      toolId: "rt-handles",
      toolVersion: 1,
      nodes: [
        {
          id: "br",
          type: "branch",
          position: { x: 0, y: 0 },
          data: { label: "b", outputs: ["yes", "no"] },
        },
        {
          id: "yesNode",
          type: "output",
          position: { x: 200, y: 0 },
          data: { label: "yes_target" },
        },
        {
          id: "noNode",
          type: "output",
          position: { x: 200, y: 100 },
          data: { label: "no_target" },
        },
      ],
      edges: [
        { id: "e-yes", source: "br", target: "yesNode", sourceHandle: "yes" },
        { id: "e-no", source: "br", target: "noNode", sourceHandle: "no" },
      ],
    };
    const g = canvasToGraph(input);
    const c = graphToCanvas(g);
    expect(c.edges.find((e) => e.id === "e-yes")?.sourceHandle).toBe("yes");
    expect(c.edges.find((e) => e.id === "e-no")?.sourceHandle).toBe("no");
  });
});
