import * as v from "valibot";
import type { Node, NodeType } from "./node";

export const EdgeSchema = v.object({
  id: v.string(),
  source: v.object({
    node_id: v.string(),
    output_id: v.optional(v.string()),
  }),
  target: v.object({
    node_id: v.string(),
  }),
});
export type Edge = v.InferOutput<typeof EdgeSchema>;

/**
 * Allowed connection matrix. Rows = source type, columns = target type.
 * See specs/node-types.md §엣지 규칙.
 */
const ALLOWED: Record<NodeType, Set<NodeType>> = {
  input: new Set(["agent", "tool", "branch", "output"]),
  agent: new Set(["agent", "tool", "branch", "output"]),
  tool: new Set(["agent", "tool", "branch", "output"]),
  branch: new Set(["agent", "tool", "output"]),
  output: new Set(),
};

export function isConnectionAllowed(from: NodeType, to: NodeType): boolean {
  return ALLOWED[from].has(to);
}

export type EdgeValidation = { ok: true } | { ok: false; reason: EdgeError };

export type EdgeError =
  | { kind: "unknown_source"; nodeId: string }
  | { kind: "unknown_target"; nodeId: string }
  | { kind: "self_loop"; nodeId: string }
  | { kind: "into_input"; targetId: string }
  | { kind: "from_output"; sourceId: string }
  | { kind: "disallowed"; from: NodeType; to: NodeType }
  | {
      kind: "branch_missing_output_id";
      sourceId: string;
    }
  | {
      kind: "branch_unknown_output_id";
      sourceId: string;
      outputId: string;
    };

export function validateEdge(edge: Edge, nodes: Node[]): EdgeValidation {
  const source = nodes.find((n) => n.id === edge.source.node_id);
  if (!source) {
    return { ok: false, reason: { kind: "unknown_source", nodeId: edge.source.node_id } };
  }
  const target = nodes.find((n) => n.id === edge.target.node_id);
  if (!target) {
    return { ok: false, reason: { kind: "unknown_target", nodeId: edge.target.node_id } };
  }
  if (source.id === target.id) {
    return { ok: false, reason: { kind: "self_loop", nodeId: source.id } };
  }
  if (target.type === "input") {
    return { ok: false, reason: { kind: "into_input", targetId: target.id } };
  }
  if (source.type === "output") {
    return { ok: false, reason: { kind: "from_output", sourceId: source.id } };
  }
  if (!isConnectionAllowed(source.type, target.type)) {
    return { ok: false, reason: { kind: "disallowed", from: source.type, to: target.type } };
  }
  if (source.type === "branch") {
    if (!edge.source.output_id) {
      return {
        ok: false,
        reason: { kind: "branch_missing_output_id", sourceId: source.id },
      };
    }
    if (!source.outputs.some((o) => o.id === edge.source.output_id)) {
      return {
        ok: false,
        reason: {
          kind: "branch_unknown_output_id",
          sourceId: source.id,
          outputId: edge.source.output_id,
        },
      };
    }
  }
  return { ok: true };
}
