import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type ToastTone = "ok" | "err" | "warn" | "info";

export interface ToastProps {
  tone?: ToastTone;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Toast({ tone = "info", icon, title, description, className }: ToastProps) {
  return (
    <div className={cn("toast", tone, className)} role="status">
      {icon ? (
        <span className="ico" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div>
        <div className="tt">{title}</div>
        {description ? <div className="td">{description}</div> : null}
      </div>
    </div>
  );
}
