import type { NodeType } from "@weaver/core";

/**
 * Canvas shape we speak to. Deliberately a subset of the full store state —
 * apps/web converts before calling, apps/runtime avoids the xyflow dep.
 */
export interface CanvasSnapshot {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

export interface SnapshotNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: { label?: string; body?: string; outputs?: string[] };
}

export interface SnapshotEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export type ComposeOp =
  | { kind: "add_node"; nodeType: NodeType }
  | { kind: "connect"; sourceLabel: string; targetLabel: string };

export interface ComposeIntent {
  ops: ComposeOp[];
  /** When ops is empty, a human-readable explanation for why. */
  reason?: string;
}

const NODE_TYPES: NodeType[] = ["input", "tool", "agent", "branch", "output"];

/**
 * Tiny offline grammar:
 *   - `add [an|a] <type> node`
 *   - `connect <label> to <label>`
 * Multiple clauses may be joined by "," or "and". Everything else falls
 * through to a reason-only intent so the caller can surface a useful message.
 */
export function parseComposeIntent(raw: string): ComposeIntent {
  const phrase = raw.toLowerCase().trim();
  if (!phrase) return { ops: [], reason: "empty prompt" };

  const clauses = phrase.split(/\s*(?:,|\band\b)\s*/).filter(Boolean);
  const ops: ComposeOp[] = [];

  for (const clause of clauses) {
    const add = clause.match(/^add\s+(?:an?\s+)?(\w+)\s+node\b.*$/);
    if (add && NODE_TYPES.includes(add[1] as NodeType)) {
      ops.push({ kind: "add_node", nodeType: add[1] as NodeType });
      continue;
    }

    const connect = clause.match(/^connect\s+(\S+)\s+to\s+(\S+)\b.*$/);
    if (connect) {
      ops.push({ kind: "connect", sourceLabel: connect[1]!, targetLabel: connect[2]! });
      continue;
    }

    // Unknown clause: bail out of the whole prompt so partial/ambiguous edits
    // don't silently land.
    return {
      ops: [],
      reason: `no offline pattern matched clause: "${clause}"`,
    };
  }

  return { ops };
}

/**
 * Apply an intent to a canvas snapshot. Pure — returns a new snapshot,
 * ignores ops that can't be satisfied (e.g. connect referencing missing
 * labels). The diff-return shape will come when we switch from "apply &
 * return" to "emit structured patch" in Week 3 proper.
 */
export function applyComposeIntent(canvas: CanvasSnapshot, intent: ComposeIntent): CanvasSnapshot {
  let nodes = [...canvas.nodes];
  let edges = [...canvas.edges];

  for (const op of intent.ops) {
    if (op.kind === "add_node") {
      const newNode: SnapshotNode = {
        id: `stub-${op.nodeType}-${nodes.length + 1}`,
        type: op.nodeType,
        position: { x: 100 + nodes.length * 40, y: 100 + nodes.length * 40 },
        data: { label: `new_${op.nodeType}` },
      };
      nodes = [...nodes, newNode];
      continue;
    }

    if (op.kind === "connect") {
      const source = nodes.find((n) => n.data.label === op.sourceLabel);
      const target = nodes.find((n) => n.data.label === op.targetLabel);
      if (!source || !target) continue;
      edges = [
        ...edges,
        {
          id: `stub-e-${edges.length + 1}`,
          source: source.id,
          target: target.id,
        },
      ];
    }
  }

  return { nodes, edges };
}
