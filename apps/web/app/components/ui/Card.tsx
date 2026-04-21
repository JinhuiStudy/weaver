import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  bodyClassName?: string;
}

export function Card({ header, bodyClassName, className, children, ...rest }: CardProps) {
  return (
    <div className={cn("card", className)} {...rest}>
      {header ? <div className="card-h">{header}</div> : null}
      <div className={cn("card-b", bodyClassName)}>{children}</div>
    </div>
  );
}
