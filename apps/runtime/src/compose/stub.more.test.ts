import { describe, expect, it } from "vitest";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./stub";

describe("parseComposeIntent · grammar robustness", () => {
  it("normalizes case (ADD AN AGENT NODE)", () => {
    const intent = parseComposeIntent("ADD AN AGENT NODE");
    expect(intent.ops[0]).toMatchObject({ kind: "add_node", nodeType: "agent" });
  });

  it("tolerates trailing punctuation", () => {
    const intent = parseComposeIntent("add an agent node.");
    expect(intent.ops[0]).toMatchObject({ kind: "add_node", nodeType: "agent" });
  });

  it("empty prompt returns empty-ops with a reason", () => {
    const intent = parseComposeIntent("");
    expect(intent.ops).toHaveLength(0);
    expect(intent.reason).toMatch(/empty/i);
  });

  it("whitespace-only prompt returns empty-ops with a reason", () => {
    const intent = parseComposeIntent("   \t ");
    expect(intent.ops).toHaveLength(0);
    expect(intent.reason).toMatch(/empty/i);
  });

  it("unknown node type (`add a spaceship node`) bails the whole prompt", () => {
    const intent = parseComposeIntent("add a spaceship node");
    expect(intent.ops).toHaveLength(0);
    expect(intent.reason).toMatch(/no offline pattern/i);
  });

  it("partial-match bail: if one clause is good and one is bad, reject all", () => {
    const intent = parseComposeIntent("add an agent node, please dance");
    expect(intent.ops).toHaveLength(0);
    expect(intent.reason).toMatch(/no offline pattern/i);
  });
});

describe("applyComposeIntent · patch semantics", () => {
  it("generates stable ids that don't collide across repeated applies", () => {
    const canvas: CanvasSnapshot = { nodes: [], edges: [] };
    const step1 = applyComposeIntent(canvas, parseComposeIntent("add an agent node"));
    const step2 = applyComposeIntent(step1, parseComposeIntent("add an agent node"));
    const ids = new Set(step2.nodes.map((n) => n.id));
    expect(ids.size).toBe(2);
  });

  it("is a no-op when the intent has no resolvable ops", () => {
    const canvas: CanvasSnapshot = {
      nodes: [
        {
          id: "n1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { label: "a" },
        },
      ],
      edges: [],
    };
    const next = applyComposeIntent(canvas, parseComposeIntent("please make coffee"));
    expect(next.nodes).toEqual(canvas.nodes);
    expect(next.edges).toEqual(canvas.edges);
  });

  it("applies add + connect in the same prompt", () => {
    const canvas: CanvasSnapshot = {
      nodes: [
        {
          id: "in",
          type: "input",
          position: { x: 0, y: 0 },
          data: { label: "webhook" },
        },
      ],
      edges: [],
    };
    const intent = parseComposeIntent("add an agent node, connect webhook to new_agent");
    const next = applyComposeIntent(canvas, intent);
    expect(next.nodes).toHaveLength(2);
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]?.source).toBe("in");
  });
});
