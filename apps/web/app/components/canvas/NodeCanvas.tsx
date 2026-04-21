import { isConnectionAllowed, type NodeType } from "@weaver/core";
import {
  Background,
  BackgroundVariant,
  Controls,
  type IsValidConnection,
  MiniMap,
  type OnSelectionChangeFunc,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type DragEvent, useCallback, useRef } from "react";
import { type NodeKind, useCanvas } from "~/stores/canvas";
import { nodeTypes } from "./nodes";

const NODE_COLOR_BY_TYPE: Record<string, string> = {
  input: "var(--node-input)",
  agent: "var(--node-agent)",
  tool: "var(--node-tool)",
  branch: "var(--node-branch)",
  output: "var(--node-output)",
};

export const PALETTE_DRAG_MIME = "application/x-weaver-node-kind";

export function NodeCanvas() {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner />
    </ReactFlowProvider>
  );
}

function NodeCanvasInner() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const onNodesChange = useCanvas((s) => s.onNodesChange);
  const onEdgesChange = useCanvas((s) => s.onEdgesChange);
  const onConnect = useCanvas((s) => s.onConnect);
  const addNode = useCanvas((s) => s.addNode);
  const setSelection = useCanvas((s) => s.setSelection);

  // Enforce the @weaver/core connection matrix (specs/node-types.md §엣지 규칙).
  // xyflow invokes this on hover during a drag; returning false suppresses the
  // green connect indicator and refuses the drop. The param is typed as
  // `Edge | Connection` (reconnect scenarios) — both share `source`/`target`.
  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false;
      const source = nodes.find((n) => n.id === conn.source);
      const target = nodes.find((n) => n.id === conn.target);
      if (!source?.type || !target?.type) return false;
      return isConnectionAllowed(source.type as NodeType, target.type as NodeType);
    },
    [nodes],
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes }) => {
      setSelection(selectedNodes[0]?.id ?? null);
    },
    [setSelection],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(PALETTE_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(PALETTE_DRAG_MIME);
      if (!raw) return;
      const kind = raw as NodeKind;
      if (!(kind in NODE_COLOR_BY_TYPE)) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(kind, position);
    },
    [addNode, screenToFlowPosition],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: DnD drop zone; keyboard alternative lives in the palette (click-to-add, TBD).
    <div ref={wrapperRef} className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.05)"
          style={{ backgroundColor: "var(--bg-canvas)" }}
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => NODE_COLOR_BY_TYPE[n.type ?? "agent"] ?? "var(--surface-4)"}
          nodeStrokeWidth={2}
          maskColor="rgba(3,3,5,0.75)"
        />
      </ReactFlow>
    </div>
  );
}
