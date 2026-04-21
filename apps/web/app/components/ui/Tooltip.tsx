import type { HTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export function Tooltip({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("tooltip", className)} {...rest}>
      {children}
    </span>
  );
}
