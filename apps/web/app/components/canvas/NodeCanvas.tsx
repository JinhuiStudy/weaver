import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback } from "react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes";

export interface NodeCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange?: ReactFlowProps["onNodesChange"];
  onEdgesChange?: ReactFlowProps["onEdgesChange"];
}

const NODE_COLOR_BY_TYPE: Record<string, string> = {
  input: "var(--node-input)",
  agent: "var(--node-agent)",
  tool: "var(--node-tool)",
  branch: "var(--node-branch)",
  output: "var(--node-output)",
};

export function NodeCanvas({ initialNodes, initialEdges }: NodeCanvasProps) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner initialNodes={initialNodes} initialEdges={initialEdges} />
    </ReactFlowProvider>
  );
}

function NodeCanvasInner({ initialNodes, initialEdges }: NodeCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback<OnConnect>(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
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
  );
}
