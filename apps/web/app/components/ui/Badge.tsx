import type { HTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export type BadgeTone =
  | "ok"
  | "err"
  | "warn"
  | "info"
  | "running"
  | "muted"
  | "solid-ok"
  | "solid-err";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  pulse?: boolean;
}

export function Badge({ tone = "muted", pulse, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)} {...rest}>
      {pulse ? <span className="pulse" aria-hidden /> : null}
      {children}
    </span>
  );
}
