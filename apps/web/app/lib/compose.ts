import type { Edge } from "@xyflow/react";
import { type CanvasNode, type NodeKind, useCanvas } from "~/stores/canvas";

/**
 * Payload shape returned by `POST /api/compose` (see apps/runtime). We only
 * look at `diff.added*` on the web side — the full `canvas` is for runtime
 * consumers who want to persist the whole snapshot.
 */
export interface ComposeResponse {
  diff?: {
    addedNodes?: Array<{
      id: string;
      type: NodeKind;
      position: { x: number; y: number };
      data: { label?: string; body?: string; kind?: string; outputs?: string[] };
    }>;
    addedEdges?: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string | null;
      label?: string;
    }>;
  };
}

/**
 * Hit the runtime compose endpoint with the live canvas, then apply the
 * returned diff to the Zustand store. Throws on HTTP/parse failure so the
 * caller can surface a UI error.
 *
 * The URL is configurable via `VITE_COMPOSE_URL` for local dev (e.g. proxy to
 * wrangler dev's port); defaults to a relative path that Cloudflare Pages
 * route rules will forward to the Worker in prod.
 */
export async function runCompose(prompt: string): Promise<ComposeResponse> {
  const url = (import.meta.env.VITE_COMPOSE_URL as string | undefined) ?? "/api/compose";
  const state = useCanvas.getState();

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      canvas: {
        nodes: state.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            label: n.data.label,
            body: typeof n.data.body === "string" ? n.data.body : undefined,
            outputs: Array.isArray(n.data.outputs) ? n.data.outputs : undefined,
          },
        })),
        edges: state.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
        })),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`compose failed · HTTP ${res.status}`);
  }
  const json = (await res.json()) as ComposeResponse;
  applyComposeDiff(json);
  return json;
}

export function applyComposeDiff(resp: ComposeResponse): void {
  const diff = resp.diff;
  if (!diff) return;

  const toStoreNode = (n: NonNullable<typeof diff.addedNodes>[number]): CanvasNode => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      label: n.data.label ?? n.id,
      kind: n.data.kind,
      body: n.data.body,
      outputs: n.data.outputs,
    },
  });

  const toStoreEdge = (e: NonNullable<typeof diff.addedEdges>[number]): Edge => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: e.label,
  });

  const state = useCanvas.getState();
  const nextNodes = [...state.nodes];
  for (const n of diff.addedNodes ?? []) {
    if (!nextNodes.some((x) => x.id === n.id)) nextNodes.push(toStoreNode(n));
  }
  const nextEdges = [...state.edges];
  for (const e of diff.addedEdges ?? []) {
    if (!nextEdges.some((x) => x.id === e.id)) nextEdges.push(toStoreEdge(e));
  }

  // One atomic hydrate preserves the current toolId and resets history — the
  // compose call is a "big bang" change, so squashing history for it is OK.
  // (Future: expose a store.applyDiff that records a single undoable step.)
  state.hydrate(state.toolId ?? "", nextNodes, nextEdges);
}
