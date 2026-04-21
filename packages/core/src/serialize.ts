import type { Edge } from "./edge";
import type { Graph } from "./graph";
import type { Node, NodeType } from "./node";

/**
 * Minimal canvas-shape input for `canvasToGraph`. Kept permissive (only the
 * fields we actually persist) so the function is easy to call from both Yjs
 * snapshots and arbitrary in-memory canvas state.
 */
export interface CanvasGraphInput {
  toolId: string;
  toolVersion: number;
  nodes: CanvasInputNode[];
  edges: CanvasInputEdge[];
}

export interface CanvasInputNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label?: string;
    kind?: string;
    body?: string;
    outputs?: string[];
  };
}

export interface CanvasInputEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
}

const DEFAULT_AGENT_MODEL = "claude-sonnet-4-6";

/**
 * Materialize a canvas state into a `@weaver/core` Graph — the authoritative
 * format used for export/import/runtime. Each node kind gets the minimum
 * viable scaffolding to satisfy `NodeSchema` so the result `parseGraph()`s
 * without crashing. Runtime code that needs richer details (agent prompts,
 * tool mappings, etc.) will eventually merge them in; for now we stamp
 * sensible defaults so the round-trip is lossless for fields the canvas
 * actually persists (position, label, body, branch outputs).
 */
export function canvasToGraph(input: CanvasGraphInput): Graph {
  return {
    version: 1 as const,
    tool_id: input.toolId,
    tool_version: input.toolVersion,
    nodes: input.nodes.map(toCoreNode),
    edges: input.edges.map(toCoreEdge),
  };
}

function toCoreNode(n: CanvasInputNode): Node {
  const base = {
    id: n.id,
    position: n.position,
    label: n.data.label ?? n.id,
    version: 1,
  } as const;

  switch (n.type) {
    case "input":
      return {
        ...base,
        type: "input",
        trigger: { kind: "manual" },
      };
    case "agent":
      return {
        ...base,
        type: "agent",
        model: DEFAULT_AGENT_MODEL,
        system_prompt: "",
        user_prompt: n.data.body ?? "",
        tool_choice: "auto",
        use_prompt_cache: true,
      };
    case "tool":
      return {
        ...base,
        type: "tool",
        tool_id: "http",
        input_mapping: {},
        output_variable: (n.data.label ?? n.id).replace(/\W+/g, "_"),
      };
    case "branch":
      return {
        ...base,
        type: "branch",
        condition_kind: "expression",
        expression: n.data.body ?? "true",
        outputs:
          n.data.outputs && n.data.outputs.length > 0
            ? n.data.outputs.map((id) => ({ id, label: id }))
            : [{ id: "default", label: "default" }],
      };
    case "output":
      return {
        ...base,
        type: "output",
        response_kind: { kind: "return_value" },
      };
  }
}

function toCoreEdge(e: CanvasInputEdge): Edge {
  return {
    id: e.id,
    source: {
      node_id: e.source,
      output_id: e.sourceHandle ?? undefined,
    },
    target: { node_id: e.target },
  };
}

/**
 * Inverse of `canvasToGraph` — rehydrates a Graph back into canvas-shaped
 * objects. Mainly used for `import from JSON` flows. Fields that don't have
 * a canvas home (e.g. agent.system_prompt) are dropped.
 */
export function graphToCanvas(graph: Graph): {
  nodes: CanvasInputNode[];
  edges: CanvasInputEdge[];
} {
  return {
    nodes: graph.nodes.map((n) => {
      const data: CanvasInputNode["data"] = { label: n.label };
      if (n.type === "branch") {
        data.body = n.expression ?? "";
        data.outputs = n.outputs.map((o) => o.id);
      } else if (n.type === "agent") {
        data.body = n.user_prompt ?? "";
      }
      return {
        id: n.id,
        type: n.type,
        position: n.position,
        data,
      };
    }),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source.node_id,
      target: e.target.node_id,
      sourceHandle: e.source.output_id ?? null,
      label: e.source.output_id,
    })),
  };
}
