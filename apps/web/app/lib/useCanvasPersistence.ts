import type { Edge } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { type CanvasNode, useCanvas } from "~/stores/canvas";
import { type CanvasDocHandle, openCanvasDoc, readFromYMap, writeToYMap } from "./yjs-provider";

export type PersistenceStatus = "idle" | "loading" | "ready";

export interface UseCanvasPersistenceOptions {
  toolId: string;
  /** Used only when IndexedDB is empty (first visit for this toolId). */
  seedNodes: CanvasNode[];
  seedEdges: Edge[];
  /** Ms of inactivity before flushing Zustand state → Y.Doc. */
  debounceMs?: number;
}

/**
 * Hydrates the canvas store from IndexedDB (via Yjs) and subscribes to
 * store changes to persist them back. Client-only; SSR returns "idle".
 *
 * Phase 1 is one-way: Zustand → Y.Doc. Remote changes via Y.Doc observers
 * are deferred to Phase 2 (realtime collab), so there's no loopback risk.
 */
export function useCanvasPersistence({
  toolId,
  seedNodes,
  seedEdges,
  debounceMs = 300,
}: UseCanvasPersistenceOptions): PersistenceStatus {
  const [status, setStatus] = useState<PersistenceStatus>("idle");

  // Seed is captured once per mount so changing array identities don't
  // re-open the doc.
  const seedRef = useRef({ nodes: seedNodes, edges: seedEdges });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    setStatus("loading");

    const handle: CanvasDocHandle = openCanvasDoc(toolId);
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeStore: (() => void) | null = null;

    void handle.whenSynced.then(() => {
      if (cancelled) return;

      // First visit — populate with seed data.
      if (handle.nodesMap.size === 0 && handle.edgesMap.size === 0) {
        writeToYMap(handle, seedRef.current.nodes, seedRef.current.edges);
      }

      const { nodes, edges } = readFromYMap(handle);
      useCanvas.getState().hydrate(toolId, nodes, edges);
      setStatus("ready");

      // Debounced Zustand → Y.Doc writer.
      unsubscribeStore = useCanvas.subscribe((state, prev) => {
        if (state.toolId !== toolId) return;
        if (state.nodes === prev.nodes && state.edges === prev.edges) return;
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          writeToYMap(handle, state.nodes, state.edges);
        }, debounceMs);
      });
    });

    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (unsubscribeStore) unsubscribeStore();
      // Final flush so latest in-memory state is persisted before tear-down.
      try {
        const state = useCanvas.getState();
        if (state.toolId === toolId) {
          writeToYMap(handle, state.nodes, state.edges);
        }
      } catch {
        // noop — store may already be reset
      }
      handle.destroy();
      useCanvas.getState().reset();
      setStatus("idle");
    };
  }, [toolId, debounceMs]);

  return status;
}
