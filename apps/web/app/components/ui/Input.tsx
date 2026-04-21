import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  mono?: boolean;
  size?: "md" | "lg";
  state?: "default" | "error" | "ok";
  leftIcon?: ReactNode;
  kbdHint?: string;
}

export function Input({
  mono,
  size = "md",
  state = "default",
  leftIcon,
  kbdHint,
  className,
  ...rest
}: InputProps) {
  const input = (
    <input
      className={cn(
        "inp",
        mono && "mono",
        size === "lg" && "inp-lg",
        state === "error" && "err",
        state === "ok" && "ok",
        leftIcon && "has-ico",
        className,
      )}
      {...rest}
    />
  );

  if (!leftIcon && !kbdHint) return input;

  return (
    <div className="field-wrap">
      {leftIcon ? <span className="ico">{leftIcon}</span> : null}
      {input}
      {kbdHint ? <span className="kbd-slot">{kbdHint}</span> : null}
    </div>
  );
}
