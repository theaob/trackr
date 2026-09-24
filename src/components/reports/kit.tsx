"use client";

import React, { useId, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/components/ui/cn";

/**
 * The pieces every report is built from: a card with its headline figure, a
 * chart/table switch, a legend, the hover card and the table view. Colours
 * come from tokens (`series(1)`, `GRID`), so the charts follow the theme.
 */

/** A token colour for SVG attributes and inline styles. */
export const tokenColor = (name: string) => `rgb(var(--color-${name}))`;
export const series = (slot: 1 | 2 | 3 | "1-soft") => tokenColor(`series-${slot}`);
export const GRID = tokenColor("border");
export const GUIDE = tokenColor("muted");
export const NEUTRAL = tokenColor("ink-2");
export const SURFACE = tokenColor("surface");

/** A small group of toggle buttons: the unit, the time window, chart or table. */
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

export interface Figure {
  label: string;
  value: React.ReactNode;
  unit?: string;
}

/** The number a report leads with, and up to three supporting figures beside it. */
export function Headline({ label, value, unit, detail, figures = [] }: Figure & { detail?: React.ReactNode; figures?: Figure[] }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <p className="text-xs font-medium text-ink-2">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight text-ink">{value}</span>
          {unit && <span className="text-sm text-ink-2">{unit}</span>}
        </p>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </div>
      {figures.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 pb-0.5">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-ink-2">{f.label}</dt>
              <dd className="text-lg font-semibold text-ink">
                {f.value}
                {f.unit && <span className="ml-1 text-xs font-normal text-ink-2">{f.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  kind?: "line" | "dash" | "box";
}

export function Swatch({ color, kind = "box" }: Omit<LegendItem, "label">) {
  if (kind === "box") return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />;
  return (
    <svg aria-hidden="true" width="16" height="8" className="shrink-0">
      <line
        style={{ stroke: color }}
        x1="1"
        y1="4"
        x2="15"
        y2="4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={kind === "dash" ? "3 3" : undefined}
      />
    </svg>
  );
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} kind={item.kind} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export interface HoverRow {
  label: string;
  value: React.ReactNode;
  color?: string;
  kind?: LegendItem["kind"];
}

/**
 * The card that follows the pointer over a chart. It repeats what the table
 * view says, so screen readers skip it.
 */
export function HoverCard({
  leftPct = 0,
  title,
  rows,
  footer,
  top = 8,
  at,
}: {
  leftPct?: number;
  title: React.ReactNode;
  rows: HoverRow[];
  footer?: HoverRow;
  top?: number;
  /** A point on screen to show the card at, for a chart inside a scrolling box. */
  at?: { x: number; y: number };
}) {
  const style: React.CSSProperties = at
    ? { position: "fixed", left: Math.max(8, Math.min(at.x, (typeof window === "undefined" ? 1024 : window.innerWidth) - 296)), top: at.y }
    : { left: `${leftPct}%`, top, transform: leftPct > 60 ? "translateX(-100%)" : undefined };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-50 min-w-40 max-w-72 rounded-card border border-subtle bg-surface px-3 py-2 text-xs text-ink shadow-overlay"
      style={style}
    >
      <p className="mb-1.5 truncate font-semibold">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color && <Swatch color={r.color} kind={r.kind} />}
              {r.label}
            </span>
            <span className="whitespace-nowrap font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
        {footer && (
          <div className="flex items-center justify-between gap-4 border-t border-subtle pt-1">
            <span className="text-ink-2">{footer.label}</span>
            <span className="font-medium tabular-nums">{footer.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export interface Column {
  label: string;
  numeric?: boolean;
}

/** The table view: every number the chart draws, for anyone who can't read the chart. */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Column[];
  rows: { key: string; cells: React.ReactNode[] }[];
}) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="max-h-96 overflow-auto rounded-control border border-subtle">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-sunk">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={cn("h-8 border-b border-subtle px-3 font-medium text-ink-2", c.numeric ? "text-right" : "text-left")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-surface-sunk">
              {r.cells.map((cell, i) => (
                <td key={i} className={cn("h-8 border-b border-subtle px-3 text-ink", columns[i]?.numeric && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A report: its title, headline figure, controls and legend, and the chart or
 * its table. The chart/table choice is per card.
 */
export function ReportCard({
  title,
  description,
  headline,
  controls,
  legend,
  chart,
  table,
}: {
  title: string;
  description?: string;
  headline?: React.ReactNode;
  controls?: React.ReactNode;
  legend?: React.ReactNode;
  chart: React.ReactNode;
  table?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const headingId = useId();
  const showing = table ? view : "chart";
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-subtle bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {table && (
          <Segmented
            label={`Show ${title.toLowerCase()} as`}
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart", icon: <BarChart3 aria-hidden="true" /> },
              { value: "table", label: "Table", icon: <Table2 aria-hidden="true" /> },
            ]}
          />
        )}
      </header>
      {headline && <div className="mt-4">{headline}</div>}
      {(controls || (legend && showing === "chart")) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {showing === "chart" ? legend : <span />}
          {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        </div>
      )}
      <div className="mt-4">{showing === "chart" ? chart : table}</div>
    </section>
  );
}

/** Horizontal gridlines with their values, for the charts with a y axis. */
export function YGrid({ ticks, yAt, x1, x2 }: { ticks: number[]; yAt: (v: number) => number; x1: number; x2: number }) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line style={{ stroke: GRID }} x1={x1} x2={x2} y1={yAt(t)} y2={yAt(t)} strokeWidth="1" shapeRendering="crispEdges" />
          <text x={x1 - 8} y={yAt(t) + 3.5} textAnchor="end" className="fill-muted tabular-nums" fontSize="11">
            {t}
          </text>
        </g>
      ))}
    </g>
  );
}

export function EmptyChart({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted [&_svg]:h-7 [&_svg]:w-7">
      {icon}
      <p className="text-xs">{children}</p>
    </div>
  );
}

/** Nearest data index to the pointer, for a hit area spanning the plot. */
export function nearestIndex(
  e: React.MouseEvent<SVGRectElement>,
  count: number,
  left: number,
  plotWidth: number,
  xAt: (i: number) => number
) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = left + ((e.clientX - rect.left) / rect.width) * plotWidth;
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const d = Math.abs(xAt(i) - x);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  return nearest;
}

export type Unit = "points" | "issues";
export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "points", label: "Story points" },
  { value: "issues", label: "Issues" },
];
export const unitShort = (u: Unit) => (u === "issues" ? "issues" : "pts");
