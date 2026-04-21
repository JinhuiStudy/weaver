import { canvasToGraph, type NodeType } from "@weaver/core";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "~/stores/canvas";

/**
 * Translate the live Zustand canvas state into an `@weaver/core` Graph and
 * trigger a browser download. The downloaded JSON is the same shape runtime
 * (apps/runtime) will consume on import — so Save = the save-format.
 */
export function downloadCanvasAsGraphJson(params: {
  toolId: string;
  toolVersion?: number;
  nodes: CanvasNode[];
  edges: Edge[];
}): void {
  const graph = canvasToGraph({
    toolId: params.toolId,
    toolVersion: params.toolVersion ?? 1,
    nodes: params.nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "agent") as NodeType,
      position: n.position,
      data: {
        label: n.data.label,
        kind: typeof n.data.kind === "string" ? n.data.kind : undefined,
        body: typeof n.data.body === "string" ? n.data.body : undefined,
        outputs: Array.isArray(n.data.outputs) ? n.data.outputs : undefined,
      },
    })),
    edges: params.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      label: typeof e.label === "string" ? e.label : undefined,
    })),
  });

  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.toolId}.weaver.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
