import { describe, expect, it } from "vitest";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./stub";

/**
 * The compose endpoint's job is: given a natural-language prompt and the
 * current canvas, produce a set of edits (add nodes, connect, rename, delete).
 * In production we'll hand this off to Workers AI. In dev/offline we parse a
 * tiny command grammar so the feature remains reviewable end-to-end without
 * requiring an API key. These tests pin the offline grammar.
 */
const emptyCanvas: CanvasSnapshot = { nodes: [], edges: [] };

describe("parseComposeIntent — offline stub grammar", () => {
  it('recognizes "add an agent node"', () => {
    const intent = parseComposeIntent("add an agent node");
    expect(intent.ops).toHaveLength(1);
    expect(intent.ops[0]).toMatchObject({ kind: "add_node", nodeType: "agent" });
  });

  it("recognizes 5 node types via their english names", () => {
    for (const kind of ["input", "tool", "agent", "branch", "output"] as const) {
      const intent = parseComposeIntent(`add a ${kind} node please`);
      expect(intent.ops[0]).toMatchObject({ kind: "add_node", nodeType: kind });
    }
  });

  it('recognizes "connect A to B"', () => {
    const intent = parseComposeIntent("connect webhook to policy_check");
    expect(intent.ops).toHaveLength(1);
    expect(intent.ops[0]).toMatchObject({
      kind: "connect",
      sourceLabel: "webhook",
      targetLabel: "policy_check",
    });
  });

  it("recognizes multiple ops separated by comma or `and`", () => {
    const intent = parseComposeIntent(
      "add an input node, add an agent node and connect input to agent",
    );
    expect(intent.ops).toHaveLength(3);
    expect(intent.ops.map((o) => o.kind)).toEqual(["add_node", "add_node", "connect"]);
  });

  it("returns an empty-ops intent with a reason when nothing matches", () => {
    const intent = parseComposeIntent("please make me a sandwich");
    expect(intent.ops).toHaveLength(0);
    expect(intent.reason).toMatch(/no offline pattern/i);
  });
});

describe("applyComposeIntent — patch canvas", () => {
  it("appends an agent node when the op says so", () => {
    const intent = parseComposeIntent("add an agent node");
    const next = applyComposeIntent(emptyCanvas, intent);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0]?.type).toBe("agent");
  });

  it("connect op resolves source/target by label", () => {
    const canvas: CanvasSnapshot = {
      nodes: [
        {
          id: "n1",
          type: "input",
          position: { x: 0, y: 0 },
          data: { label: "webhook" },
        },
        {
          id: "n2",
          type: "agent",
          position: { x: 200, y: 0 },
          data: { label: "policy_check" },
        },
      ],
      edges: [],
    };
    const intent = parseComposeIntent("connect webhook to policy_check");
    const next = applyComposeIntent(canvas, intent);
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ source: "n1", target: "n2" });
  });

  it("skips a connect op whose labels don't resolve to real nodes", () => {
    const intent = parseComposeIntent("connect nobody to nothing");
    const next = applyComposeIntent(emptyCanvas, intent);
    expect(next.edges).toHaveLength(0);
  });
});
