import { graphToCanvas, parseGraph } from "@weaver/core";
import type { Edge } from "@xyflow/react";
import type { CanvasNode, NodeKind } from "~/stores/canvas";

/**
 * Read a weaver.json file, validate it through `@weaver/core`'s parseGraph,
 * then lift it into the canvas-shaped arrays the store accepts. Throws on
 * parse/validation failure so the caller can surface the message.
 */
export async function loadCanvasFromFile(file: File): Promise<{
  nodes: CanvasNode[];
  edges: Edge[];
  toolId: string;
  toolVersion: number;
}> {
  const text = await file.text();
  const json: unknown = JSON.parse(text);
  const graph = parseGraph(json);
  const canvas = graphToCanvas(graph);

  const nodes: CanvasNode[] = canvas.nodes.map((n) => ({
    id: n.id,
    type: n.type as NodeKind,
    position: n.position,
    data: {
      label: n.data.label ?? n.id,
      kind: typeof n.data.kind === "string" ? n.data.kind : undefined,
      body: typeof n.data.body === "string" ? n.data.body : undefined,
      outputs: Array.isArray(n.data.outputs) ? n.data.outputs : undefined,
    },
  }));

  const edges: Edge[] = canvas.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: e.label,
  }));

  return { nodes, edges, toolId: graph.tool_id, toolVersion: graph.tool_version };
}
