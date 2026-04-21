import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outlined"
  | "ghost"
  | "danger"
  | "success"
  | "ai";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size,
  loading,
  iconOnly,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "btn",
        `btn-${variant}`,
        size && `btn-${size}`,
        iconOnly && "btn-icon",
        loading && "loading",
        className,
      )}
      {...rest}
    >
      {loading ? <span className="spin" aria-hidden /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
