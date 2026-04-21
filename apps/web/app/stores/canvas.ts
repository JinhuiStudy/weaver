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

export interface CanvasStore {
  toolId: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
  selectedId: string | null;

  hydrate: (toolId: string, nodes: CanvasNode[], edges: Edge[]) => void;
  reset: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => CanvasNode;
  updateNodeData: (id: string, patch: Partial<WvFlowNodeData>) => void;
  removeNode: (id: string) => void;

  setSelection: (id: string | null) => void;
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

export const useCanvas = create<CanvasStore>((set, get) => ({
  toolId: null,
  nodes: [],
  edges: [],
  selectedId: null,

  hydrate: (toolId, nodes, edges) => set({ toolId, nodes, edges, selectedId: null }),

  reset: () => set({ toolId: null, nodes: [], edges: [], selectedId: null }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[] }),

  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (conn) =>
    set({
      edges: addEdge({ ...conn, id: `e-${genId()}` }, get().edges),
    }),

  addNode: (kind, position) => {
    const node: CanvasNode = {
      id: genId(),
      type: kind,
      position,
      data: { ...DEFAULT_DATA_FOR_KIND[kind] },
    };
    set({ nodes: [...get().nodes, node], selectedId: node.id });
    return node;
  },

  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }),

  removeNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  setSelection: (id) => set({ selectedId: id }),
}));
