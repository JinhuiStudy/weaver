import * as v from "valibot";
import { type EdgeError, EdgeSchema, validateEdge } from "./edge.ts";
import { NodeSchema } from "./node.ts";

export const GraphSchema = v.object({
  version: v.literal(1),
  tool_id: v.string(),
  tool_version: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nodes: v.array(NodeSchema),
  edges: v.array(EdgeSchema),
});
export type Graph = v.InferOutput<typeof GraphSchema>;

export function parseGraph(value: unknown): Graph {
  return v.parse(GraphSchema, value);
}

export type GraphValidation = { ok: true } | { ok: false; errors: GraphError[] };

export type GraphError =
  | { kind: "no_input" }
  | { kind: "no_output" }
  | { kind: "duplicate_node_id"; nodeId: string }
  | { kind: "duplicate_edge_id"; edgeId: string }
  | { kind: "isolated_node"; nodeId: string }
  | { kind: "cycle"; nodeIds: string[] }
  | { kind: "edge"; edgeId: string; error: EdgeError };

/**
 * Validates structural + semantic rules from specs/node-types.md §검증 규칙:
 * - ≥ 1 input, ≥ 1 output
 * - unique ids
 * - edges obey the connection matrix
 * - DAG (no cycles)
 * - every node reachable from some input
 */
export function validateGraph(graph: Graph): GraphValidation {
  const errors: GraphError[] = [];

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({ kind: "duplicate_node_id", nodeId: node.id });
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({ kind: "duplicate_edge_id", edgeId: edge.id });
    }
    edgeIds.add(edge.id);
  }

  const hasInput = graph.nodes.some((n) => n.type === "input");
  if (!hasInput) errors.push({ kind: "no_input" });

  const hasOutput = graph.nodes.some((n) => n.type === "output");
  if (!hasOutput) errors.push({ kind: "no_output" });

  for (const edge of graph.edges) {
    const result = validateEdge(edge, graph.nodes);
    if (!result.ok) {
      errors.push({ kind: "edge", edgeId: edge.id, error: result.reason });
    }
  }

  const cycle = findCycle(graph);
  if (cycle) errors.push({ kind: "cycle", nodeIds: cycle });

  for (const isolated of findIsolatedNodes(graph)) {
    errors.push({ kind: "isolated_node", nodeId: isolated });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Returns a node id sequence forming a cycle, or null if acyclic. */
export function findCycle(graph: Graph): string[] | null {
  const adjacency = buildAdjacency(graph);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  for (const node of graph.nodes) {
    color.set(node.id, WHITE);
    parent.set(node.id, null);
  }

  const reconstruct = (start: string, end: string): string[] => {
    const path: string[] = [end];
    let cur: string | null | undefined = start;
    while (cur && cur !== end) {
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    path.push(end);
    return path.reverse();
  };

  const visit = (nodeId: string): string[] | null => {
    color.set(nodeId, GRAY);
    for (const next of adjacency.get(nodeId) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        return reconstruct(nodeId, next);
      }
      if (c === WHITE) {
        parent.set(next, nodeId);
        const found = visit(next);
        if (found) return found;
      }
    }
    color.set(nodeId, BLACK);
    return null;
  };

  for (const node of graph.nodes) {
    if (color.get(node.id) === WHITE) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}

/** Nodes not reachable from any input node. Does not count input nodes themselves. */
export function findIsolatedNodes(graph: Graph): string[] {
  const adjacency = buildAdjacency(graph);
  const reachable = new Set<string>();
  const stack: string[] = graph.nodes.filter((n) => n.type === "input").map((n) => n.id);

  while (stack.length) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const next of adjacency.get(id) ?? []) {
      stack.push(next);
    }
  }

  return graph.nodes.filter((n) => n.type !== "input" && !reachable.has(n.id)).map((n) => n.id);
}

function buildAdjacency(graph: Graph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) {
    const list = adj.get(edge.source.node_id);
    if (list) list.push(edge.target.node_id);
  }
  return adj;
}
