import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import { Tooltip } from "./Popover";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-ink border border-subtle hover:bg-surface-sunk hover:border-strong",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-surface-sunk hover:text-ink",
  danger: "bg-danger text-accent-fg hover:bg-danger/90 border border-transparent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
};

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and marks it busy. */
  loading?: boolean;
}

/** The one button. Defaults to type="button" so it never submits a form by accident. */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<React.ComponentProps<"button">, "children" | "aria-label"> {
  /** What the button does, for screen readers and as its tooltip. Required: an icon has no name of its own. */
  label: string;
  icon: React.ReactNode;
  variant?: Exclude<ButtonVariant, "primary" | "danger">;
  size?: ButtonSize;
}

/** A square button that shows only an icon, with its label as a tooltip. At least 28 px, above the 24 px target minimum. */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  title,
  ...props
}: IconButtonProps) {
  // The label shows as a tooltip on hover and keyboard focus (a title attribute
  // would reach neither keyboard nor touch users).
  return (
    <Tooltip content={title ?? label}>
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4",
        VARIANTS[variant],
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        className
      )}
      {...props}
    >
      {icon}
    </button>
    </Tooltip>
  );
}
