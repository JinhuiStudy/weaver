import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";

// Web Crypto's randomUUID is available in Workers, modern browsers, and Node 19+.
// Keeps this module runtime-agnostic (no `node:crypto` import).
const genId = () => crypto.randomUUID();

import type { WvFlowNodeData } from "~/components/canvas/nodes";

export type NodeKind = "input" | "agent" | "tool" | "branch" | "output";
export type CanvasNode = Node<WvFlowNodeData>;

interface Snapshot {
  nodes: CanvasNode[];
  edges: Edge[];
}

const HISTORY_LIMIT = 50;

export interface CanvasStore {
  toolId: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
  selectedId: string | null;

  /** Past snapshots (oldest → newest). Undo pops from the end. */
  history: Snapshot[];
  /** Redo stack (newest → oldest). Populated only while stepping backwards. */
  future: Snapshot[];

  hydrate: (toolId: string, nodes: CanvasNode[], edges: Edge[]) => void;
  reset: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => CanvasNode;
  updateNodeData: (id: string, patch: Partial<WvFlowNodeData>) => void;
  removeNode: (id: string) => void;

  /** Branch-specific: add an output port (creates a new right-side handle). */
  addBranchOutput: (nodeId: string, outputId: string) => void;
  /**
   * Branch-specific: remove an output port. Also cascades any edges whose
   * sourceHandle referenced that port, so the canvas doesn't end up with
   * dangling edges pointing at a now-missing handle.
   */
  removeBranchOutput: (nodeId: string, outputId: string) => void;

  setSelection: (id: string | null) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const DEFAULT_DATA_FOR_KIND: Record<NodeKind, WvFlowNodeData> = {
  input: { kind: "INPUT · WEBHOOK", label: "new_input", body: "POST /events" },
  agent: {
    kind: "AGENT · CLAUDE",
    label: "new_agent",
    body: "model: sonnet-4-6\ntemp: 0.2",
  },
  tool: {
    kind: "TOOL · HTTP",
    label: "new_tool",
    body: "GET /…\nretry: 3",
  },
  branch: {
    kind: "BRANCH · IF",
    label: "new_branch",
    body: "condition: …",
    outputs: ["yes", "no"],
  },
  output: {
    kind: "OUTPUT",
    label: "new_output",
    body: "return 200",
  },
};

/**
 * Deep-clone the graph payload so a snapshot is truly detached from later
 * mutations AND so re-applying it on undo/redo gives React/xyflow fresh object
 * references. xyflow v12's memoized node wrappers compare `data` by reference;
 * without a deep clone, restoring a pre-rename snapshot would retain the original
 * data reference and xyflow would skip the re-render even though the label
 * changed back.
 */
function snapshotOf(state: Pick<CanvasStore, "nodes" | "edges">): Snapshot {
  return {
    nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data } })),
    edges: state.edges.map((e) => ({ ...e })),
  };
}

export const useCanvas = create<CanvasStore>((set, get) => {
  /**
   * Push the current {nodes, edges} into history and clear redo stack.
   * Call BEFORE a semantic mutation. Not called on xyflow drag/position
   * updates — that would spam history with every frame of a drag.
   */
  const pushHistory = (reason: string): void => {
    const snap = snapshotOf(get());
    const next = [...get().history, snap].slice(-HISTORY_LIMIT);
    set({ history: next, future: [] });
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[canvas] pushHistory", reason, "→ len", next.length);
    }
  };

  // Tracks whether we're currently mid-drag so drag-end (`dragging === false`)
  // only records history when preceded by `dragging === true`. See onNodesChange.
  let wasDragging = false;

  return {
    toolId: null,
    nodes: [],
    edges: [],
    selectedId: null,
    history: [],
    future: [],

    hydrate: (toolId, nodes, edges) =>
      set({ toolId, nodes, edges, selectedId: null, history: [], future: [] }),

    reset: () =>
      set({
        toolId: null,
        nodes: [],
        edges: [],
        selectedId: null,
        history: [],
        future: [],
      }),

    onNodesChange: (changes) => {
      // Position drags come through here as 'position' changes with dragging=true.
      // Only real semantic events should touch history:
      //   - remove (Delete key)
      //   - position with dragging explicitly === false (drag END after true)
      // `dragging === false` ALONE is not enough — xyflow also emits position
      // changes without any `dragging` field (e.g. programmatic fitView moves)
      // and those were tripping the recorder on every test interaction.
      // By tracking "was the last drag in progress?" we only record on real
      // drag completions.
      const shouldRecord = changes.some((c) => {
        if (c.type === "remove") return true;
        if (c.type === "position" && c.dragging === false && wasDragging) return true;
        return false;
      });
      // Update the drag tracker for the NEXT call.
      for (const c of changes) {
        if (c.type === "position") {
          if (c.dragging === true) wasDragging = true;
          else if (c.dragging === false) wasDragging = false;
        }
      }
      if (shouldRecord) pushHistory(`onNodesChange:${changes.map((c) => c.type).join(",")}`);
      set({ nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[] });
    },

    onEdgesChange: (changes) => {
      const shouldRecord = changes.some((c) => c.type === "remove");
      if (shouldRecord) pushHistory(`onNodesChange:${changes.map((c) => c.type).join(",")}`);
      set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (conn) => {
      pushHistory("onConnect");
      set({ edges: addEdge({ ...conn, id: `e-${genId()}` }, get().edges) });
    },

    addNode: (kind, position) => {
      pushHistory("addNode");
      const node: CanvasNode = {
        id: genId(),
        type: kind,
        position,
        data: { ...DEFAULT_DATA_FOR_KIND[kind] },
      };
      set({ nodes: [...get().nodes, node], selectedId: node.id });
      return node;
    },

    updateNodeData: (id, patch) => {
      pushHistory("updateNodeData");
      set({
        nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      });
    },

    removeNode: (id) => {
      pushHistory("removeNode");
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
      });
    },

    addBranchOutput: (nodeId, outputId) => {
      pushHistory("addBranchOutput");
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== nodeId || n.type !== "branch") return n;
          const current = n.data.outputs ?? [];
          if (current.includes(outputId)) return n;
          return { ...n, data: { ...n.data, outputs: [...current, outputId] } };
        }),
      });
    },

    removeBranchOutput: (nodeId, outputId) => {
      pushHistory("removeBranchOutput");
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== nodeId || n.type !== "branch") return n;
          const next = (n.data.outputs ?? []).filter((o) => o !== outputId);
          return { ...n, data: { ...n.data, outputs: next } };
        }),
        // Cascade: drop any edges whose sourceHandle targeted the removed port.
        edges: get().edges.filter((e) => !(e.source === nodeId && e.sourceHandle === outputId)),
      });
    },

    setSelection: (id) => set({ selectedId: id }),

    undo: () => {
      const { history, future } = get();
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      if (!previous) return;
      const current = snapshotOf(get());
      set({
        nodes: previous.nodes,
        edges: previous.edges,
        history: history.slice(0, -1),
        future: [...future, current],
      });
    },

    redo: () => {
      const { history, future } = get();
      if (future.length === 0) return;
      const next = future[future.length - 1];
      if (!next) return;
      const current = snapshotOf(get());
      set({
        nodes: next.nodes,
        edges: next.edges,
        history: [...history, current],
        future: future.slice(0, -1),
      });
    },

    canUndo: () => get().history.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

// Test-only global for Playwright to probe store state in dev mode.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __canvas: typeof useCanvas }).__canvas = useCanvas;
}
