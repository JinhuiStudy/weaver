import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import type { NodeState, NodeType } from "../WvNode";

export interface FlowNodeData {
  kind?: string;
  label: string;
  body?: ReactNode;
  state?: NodeState;
  statusPill?: ReactNode;
  durationPill?: ReactNode;
}

export interface FlowNodeShellProps {
  type: NodeType;
  data: FlowNodeData;
  selected?: boolean;
  hasInput?: boolean;
  /**
   * For branch nodes, list output port ids to render multiple right-side handles.
   * For all other types, `true` = single output, `false` = none.
   */
  outputs?: true | false | string[];
}

/**
 * xyflow-wired shell that reuses the Weaver node visual (see WvNode).
 * Handles are placed on the outer borders using xyflow's Position.
 */
export function FlowNodeShell({
  type,
  data,
  selected,
  hasInput = true,
  outputs = true,
}: FlowNodeShellProps) {
  const effectiveState: NodeState = selected ? "selected" : (data.state ?? "default");
  const kindLabel = data.kind ?? type.toUpperCase();

  return (
    <div
      className={cn("wv-node", `n-${type}`, effectiveState !== "default" && `st-${effectiveState}`)}
    >
      {data.statusPill ? <span className="status-pill">{data.statusPill}</span> : null}

      <div className="head">
        <span className="dot" aria-hidden />
        <span className="kind">{kindLabel}</span>
      </div>
      <h4 className="label">{data.label}</h4>
      {data.body ? <div className="body">{data.body}</div> : null}

      {hasInput ? (
        <Handle
          type="target"
          position={Position.Left}
          className="wv-flow-handle in"
          aria-label={`${data.label} input`}
        />
      ) : null}

      {outputs === true ? (
        <Handle
          type="source"
          position={Position.Right}
          className="wv-flow-handle out"
          aria-label={`${data.label} output`}
        />
      ) : null}

      {Array.isArray(outputs) && outputs.length > 0
        ? outputs.map((oid, i) => {
            const top = ((i + 1) / (outputs.length + 1)) * 100;
            return (
              <Handle
                key={oid}
                id={oid}
                type="source"
                position={Position.Right}
                className="wv-flow-handle out"
                style={{ top: `${top}%` }}
                aria-label={`${data.label} ${oid}`}
              />
            );
          })
        : null}

      {data.durationPill ? <span className="dur-pill">{data.durationPill}</span> : null}
    </div>
  );
}
