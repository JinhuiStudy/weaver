import type { NodeProps, NodeTypes } from "@xyflow/react";
import { type FlowNodeData, FlowNodeShell } from "./FlowNodeShell";

export type WvFlowNodeData = FlowNodeData & {
  /** Branch nodes: list of output port ids, rendered as right-side handles. */
  outputs?: string[];
  [key: string]: unknown;
};

function readData(props: NodeProps): WvFlowNodeData {
  return props.data as WvFlowNodeData;
}

function InputFlowNode(props: NodeProps) {
  return (
    <FlowNodeShell type="input" data={readData(props)} selected={props.selected} hasInput={false} />
  );
}

function AgentFlowNode(props: NodeProps) {
  return <FlowNodeShell type="agent" data={readData(props)} selected={props.selected} />;
}

function ToolFlowNode(props: NodeProps) {
  return <FlowNodeShell type="tool" data={readData(props)} selected={props.selected} />;
}

function BranchFlowNode(props: NodeProps) {
  const data = readData(props);
  return (
    <FlowNodeShell
      type="branch"
      data={data}
      selected={props.selected}
      outputs={data.outputs && data.outputs.length > 0 ? data.outputs : true}
    />
  );
}

function OutputFlowNode(props: NodeProps) {
  return (
    <FlowNodeShell type="output" data={readData(props)} selected={props.selected} outputs={false} />
  );
}

export const nodeTypes: NodeTypes = {
  input: InputFlowNode,
  agent: AgentFlowNode,
  tool: ToolFlowNode,
  branch: BranchFlowNode,
  output: OutputFlowNode,
};
