import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type NodeType = "input" | "agent" | "tool" | "branch" | "output";
export type NodeState =
  | "default"
  | "hover"
  | "selected"
  | "running"
  | "error"
  | "warn"
  | "disabled";

export interface WvNodeProps extends HTMLAttributes<HTMLDivElement> {
  type: NodeType;
  kind?: string;
  label: ReactNode;
  body?: ReactNode;
  state?: NodeState;
  statusPill?: ReactNode;
  durationPill?: ReactNode;
  inPort?: boolean;
  outPort?: boolean;
}

export function WvNode({
  type,
  kind,
  label,
  body,
  state = "default",
  statusPill,
  durationPill,
  inPort = true,
  outPort = true,
  className,
  style,
  ...rest
}: WvNodeProps) {
  const kindLabel = kind ?? type.toUpperCase();
  return (
    <div
      className={cn("wv-node", `n-${type}`, state !== "default" && `st-${state}`, className)}
      style={style}
      {...rest}
    >
      {statusPill ? <span className="status-pill">{statusPill}</span> : null}
      <div className="head">
        <span className="dot" aria-hidden />
        <span className="kind">{kindLabel}</span>
      </div>
      <h4 className="label">{label}</h4>
      {body ? <div className="body">{body}</div> : null}
      {inPort ? <span className="port in" aria-hidden /> : null}
      {outPort ? <span className="port out" aria-hidden /> : null}
      {durationPill ? <span className="dur-pill">{durationPill}</span> : null}
    </div>
  );
}
