"use client";

import React from "react";
import { cn } from "./cn";

/** A small group of toggle buttons: a unit, a time window, chart or table, a theme. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-control border border-subtle bg-surface-sunk p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
            value === o.value ? "bg-surface text-ink shadow-raised" : "text-ink-2 hover:text-ink"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
