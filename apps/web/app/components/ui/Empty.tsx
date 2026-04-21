import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export interface EmptyProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Empty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn("empty", className)}>
      {icon ? <div className="ico">{icon}</div> : null}
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
