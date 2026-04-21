import type { Edge } from "@xyflow/react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import type { CanvasNode } from "~/stores/canvas";

export interface CanvasDocHandle {
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  readonly nodesMap: Y.Map<CanvasNode>;
  readonly edgesMap: Y.Map<Edge>;
  readonly whenSynced: Promise<void>;
  destroy(): void;
}

/**
 * Open (or reuse) a Yjs document for a given tool_id.
 * Persists to IndexedDB via y-indexeddb. Client-only — the caller must
 * gate with `typeof window !== "undefined"` or invoke from an effect.
 *
 * Phase 1 storage format: two top-level Y.Maps keyed by node/edge id,
 * storing the whole object as a plain JSON value. Coarse CRDT is fine
 * while Weaver is single-user local-first (Phase 2 upgrades to per-field
 * Y.Maps + y-websocket for realtime presence — see ADR-004).
 */
export function openCanvasDoc(toolId: string): CanvasDocHandle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`weaver:canvas:${toolId}`, doc);
  const nodesMap = doc.getMap<CanvasNode>("nodes");
  const edgesMap = doc.getMap<Edge>("edges");

  const whenSynced = new Promise<void>((resolve) => {
    persistence.once("synced", () => resolve());
  });

  return {
    doc,
    persistence,
    nodesMap,
    edgesMap,
    whenSynced,
    destroy() {
      persistence.destroy();
      doc.destroy();
    },
  };
}

export function readFromYMap(handle: CanvasDocHandle): {
  nodes: CanvasNode[];
  edges: Edge[];
} {
  return {
    nodes: Array.from(handle.nodesMap.values()),
    edges: Array.from(handle.edgesMap.values()),
  };
}

/**
 * Reconcile the Y.Maps with the given arrays. Deletions are computed from id set
 * difference; upserts are a flat `.set()`. Wrapped in a single transaction so
 * IndexedDB persists one update per call.
 */
export function writeToYMap(handle: CanvasDocHandle, nodes: CanvasNode[], edges: Edge[]): void {
  const { doc, nodesMap, edgesMap } = handle;
  doc.transact(() => {
    const nextNodeIds = new Set(nodes.map((n) => n.id));
    for (const id of Array.from(nodesMap.keys())) {
      if (!nextNodeIds.has(id)) nodesMap.delete(id);
    }
    for (const n of nodes) nodesMap.set(n.id, n);

    const nextEdgeIds = new Set(edges.map((e) => e.id));
    for (const id of Array.from(edgesMap.keys())) {
      if (!nextEdgeIds.has(id)) edgesMap.delete(id);
    }
    for (const e of edges) edgesMap.set(e.id, e);
  });
}
