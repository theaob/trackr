import React from "react";
import { cn } from "./cn";

/** A workflow colour as #RGB or #RRGGBB, or null when it isn't one. */
export function parseHexColor(color: string | null | undefined): { r: number; g: number; b: number } | null {
  const match = color?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export interface StatusLozengeProps {
  /** The status name as the workflow spells it, e.g. "In review". */
  label: string;
  /** The colour chosen in workflow settings. */
  color?: string | null;
  /** A theme colour instead, by token name ("accent", "danger", "series-1"). */
  token?: string;
  className?: string;
}

/**
 * A status as a coloured dot on a 14% tint of that colour, with the label in
 * the normal text colour. Unlike a label written in the colour itself, any
 * colour a project picks, pale yellow included, stays readable in both themes.
 */
export function StatusLozenge({ label, color, token, className }: StatusLozengeProps) {
  const rgb = parseHexColor(color);
  const channels = token ? `var(--color-${token})` : rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : "var(--color-muted)";
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium text-ink",
        className
      )}
      style={{ backgroundColor: `rgb(${channels} / 0.14)` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: `rgb(${channels})` }} />
      <span className="truncate">{label}</span>
    </span>
  );
}
