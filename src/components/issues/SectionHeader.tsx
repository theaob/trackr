import React from "react";
import { cn } from "@/components/ui/cn";

/**
 * The heading row of a section in the issue view: its name, a count, and its
 * actions on the right. An empty section is just this row, so "Add link" and
 * the like stay one click away without an empty box taking up the space.
 */
export default function SectionHeader({
  title,
  count,
  icon,
  children,
  className,
}: {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center gap-2", className)}>
      {icon ? <span className="text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      {count ? <span className="font-mono text-[11px] text-ink-2">{count}</span> : null}
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  );
}

/** A small action in a section header: "Add link", "Add files". */
export function SectionAction({
  icon,
  children,
  pressed,
  className,
  ...props
}: React.ComponentProps<"button"> & { icon?: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-control px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-sunk hover:text-ink disabled:opacity-50",
        "aria-pressed:bg-accent-soft aria-pressed:text-accent [&_svg]:h-3.5 [&_svg]:w-3.5",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
