import type { HTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export function Kbd({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd className={cn("kbd", className)} {...rest}>
      {children}
    </kbd>
  );
}
