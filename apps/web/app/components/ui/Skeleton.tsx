import type { HTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export function Skeleton({ className, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skel", className)} style={style} aria-hidden {...rest} />;
}
