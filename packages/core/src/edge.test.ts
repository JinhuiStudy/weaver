import { describe, expect, it } from "vitest";
import { type Edge, isConnectionAllowed, validateEdge } from "./edge.ts";
import type { Node } from "./node.ts";

const nodes: Node[] = [
  {
    id: "in1",
    type: "input",
    position: { x: 0, y: 0 },
    label: "webhook",
    version: 1,
    trigger: { kind: "webhook", auth: "none" },
  },
  {
    id: "ag1",
    type: "agent",
    position: { x: 0, y: 0 },
    label: "check",
    version: 1,
    model: "claude-sonnet-4-6",
    system_prompt: "",
    user_prompt: "",
    tool_choice: "auto",
    use_prompt_cache: false,
  },
  {
    id: "br1",
    type: "branch",
    position: { x: 0, y: 0 },
    label: "split",
    version: 1,
    condition_kind: "expression",
    expression: "x > 0",
    outputs: [
      { id: "yes", label: "yes" },
      { id: "no", label: "no" },
    ],
  },
  {
    id: "out1",
    type: "output",
    position: { x: 0, y: 0 },
    label: "done",
    version: 1,
    response_kind: { kind: "return_value" },
  },
];

const edge = (id: string, sourceId: string, targetId: string, outputId?: string): Edge => ({
  id,
  source: { node_id: sourceId, output_id: outputId },
  target: { node_id: targetId },
});

describe("isConnectionAllowed", () => {
  it("allows input → agent", () => {
    expect(isConnectionAllowed("input", "agent")).toBe(true);
  });
  it("rejects output → anything", () => {
    expect(isConnectionAllowed("output", "agent")).toBe(false);
    expect(isConnectionAllowed("output", "output")).toBe(false);
  });
  it("rejects anything → input", () => {
    expect(isConnectionAllowed("agent", "input")).toBe(false);
  });
  it("rejects branch → input (explicit)", () => {
    expect(isConnectionAllowed("branch", "input")).toBe(false);
  });
  it("rejects branch → branch (dead-end chain)", () => {
    expect(isConnectionAllowed("branch", "branch")).toBe(false);
  });
});

describe("validateEdge", () => {
  it("accepts input → agent", () => {
    const result = validateEdge(edge("e1", "in1", "ag1"), nodes);
    expect(result.ok).toBe(true);
  });

  it("rejects edge with unknown source node", () => {
    const result = validateEdge(edge("e1", "missing", "ag1"), nodes);
    expect(result).toEqual({
      ok: false,
      reason: { kind: "unknown_source", nodeId: "missing" },
    });
  });

  it("rejects self loops", () => {
    const result = validateEdge(edge("e1", "ag1", "ag1"), nodes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.kind).toBe("self_loop");
  });

  it("rejects edges into input", () => {
    const result = validateEdge(edge("e1", "ag1", "in1"), nodes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.kind).toBe("into_input");
  });

  it("rejects branch edge without output_id", () => {
    const result = validateEdge(edge("e1", "br1", "out1"), nodes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.kind).toBe("branch_missing_output_id");
  });

  it("rejects branch edge with unknown output_id", () => {
    const result = validateEdge(edge("e1", "br1", "out1", "mystery"), nodes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.kind).toBe("branch_unknown_output_id");
  });

  it("accepts branch edge with valid output_id", () => {
    const result = validateEdge(edge("e1", "br1", "out1", "yes"), nodes);
    expect(result.ok).toBe(true);
  });
});
