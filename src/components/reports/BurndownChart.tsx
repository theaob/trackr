"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { TrendingDown } from "lucide-react";
import { useChartWidth } from "@/hooks/useChartWidth";
import type { BurndownPoint } from "@/lib/burndown";
import { niceAxis } from "./chartScale";
import {
  DataTable,
  EmptyChart,
  GUIDE,
  Headline,
  HoverCard,
  Legend,
  NEUTRAL,
  nearestIndex,
  ReportCard,
  Segmented,
  series,
  SURFACE,
  UNIT_OPTIONS,
  unitShort,
  YGrid,
  type Unit,
} from "./kit";

interface BurndownChartProps {
  points: BurndownPoint[];
  totalPoints: number;
  totalIssues?: number;
  unit?: string;
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 40 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

type Mode = "burndown" | "burnup";

/**
 * Sprint burndown (work left against the guideline) and burnup (work done
 * climbing toward scope), in story points or issues. It leads with the work
 * remaining and how far scope has moved since the sprint started.
 */
export default function BurndownChart({ points, totalPoints, totalIssues, unit }: BurndownChartProps) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [mode, setMode] = useState<Mode>("burndown");
  const [metric, setMetric] = useState<Unit>(unit === "issues" ? "issues" : "points");
  const [hover, setHover] = useState<number | null>(null);
  const issues = metric === "issues";
  const u = unitShort(metric);
  const last = Math.max(1, points.length - 1);

  // Every value the chart and the table show, per day.
  const rows = useMemo(
    () =>
      points.map((p, i) => {
        const scope = issues ? p.totalIssues : p.scope;
        return {
          date: p.date,
          scope,
          guide: issues ? (p.totalIssues || 1) * (1 - i / last) : p.ideal,
          idealDone: (scope || 1) * (i / last),
          remaining: issues ? p.remainingIssues : p.remaining,
          completed: issues ? p.completedIssues : p.completed,
        };
      }),
    [points, issues, last]
  );

  const max = Math.max(1, ...rows.map((r) => r.scope || 0), issues ? totalIssues || 1 : totalPoints || 1);
  const { ticks, axisMax } = niceAxis(max);
  const xAt = (i: number) => (points.length > 1 ? MARGIN.left + (i / last) * PLOT_WIDTH : MARGIN.left + PLOT_WIDTH / 2);
  const yAt = (v: number) => MARGIN.top + PLOT_HEIGHT - (v / axisMax) * PLOT_HEIGHT;
  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

  // A day's value is known at its end, so it is drawn at the next day's mark.
  const actual = (pick: (r: (typeof rows)[number]) => number | null, start: number) => {
    const known = rows.map((r, i) => ({ i, v: pick(r) })).filter((k): k is { i: number; v: number } => k.v !== null);
    if (known.length === 0) return [];
    return [{ x: xAt(0), y: yAt(start), v: start }, ...known.map((k) => ({ x: xAt(Math.min(k.i + 1, last)), y: yAt(k.v), v: k.v }))];
  };
  const startRemaining = issues ? (totalIssues ?? rows[0]?.remaining ?? 0) : totalPoints > 0 ? totalPoints : (rows[0]?.remaining ?? 0);
  const remainingPts = actual((r) => r.remaining, startRemaining);
  const completedPts = actual((r) => r.completed, 0);

  const known = rows.filter((r) => r.remaining !== null);
  const now = known[known.length - 1] ?? rows[0];
  const scopeNow = now?.scope ?? 0;
  const done = now?.completed ?? 0;
  const left = now?.remaining ?? 0;
  const scopeChange = scopeNow - (rows[0]?.scope ?? 0);
  const pct = scopeNow > 0 ? Math.round((done / scopeNow) * 100) : 0;

  const empty = points.length < 2 || max === 0;
  const primary = mode === "burndown" ? remainingPts : completedPts;
  const accent = series(1);
  const legend =
    mode === "burndown"
      ? [
          { label: "Remaining", color: accent, kind: "line" as const },
          { label: "Guideline", color: GUIDE, kind: "dash" as const },
        ]
      : [
          { label: "Completed", color: accent, kind: "line" as const },
          { label: "Scope", color: NEUTRAL, kind: "line" as const },
          { label: "Ideal pace", color: GUIDE, kind: "dash" as const },
        ];

  const hovered = hover !== null ? rows[hover] : null;
  const fmt = (v: number | null) => (v === null ? "–" : `${Math.round(v)} ${u}`);

  const chart = empty ? (
    <EmptyChart icon={<TrendingDown aria-hidden="true" />}>Not enough data yet to plot this sprint.</EmptyChart>
  ) : (
    <div className="relative" ref={chartRef}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`${mode === "burndown" ? "Burndown" : "Burnup"} chart. The table view lists every day.`}
      >
        <YGrid ticks={ticks} yAt={yAt} x1={MARGIN.left} x2={WIDTH - MARGIN.right} />
        {[0, Math.floor(last / 2), last].map((i, n) => (
          <text
            key={n}
            x={xAt(i)}
            y={HEIGHT - 8}
            textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}
            className="fill-muted"
            fontSize="11"
          >
            {format(points[i].date, "MMM d")}
          </text>
        ))}
        {primary.length > 1 && (
          <path
            style={{ fill: accent }}
            d={`${line(primary)} L ${primary[primary.length - 1].x} ${yAt(0)} L ${primary[0].x} ${yAt(0)} Z`}
            fillOpacity="0.1"
          />
        )}
        {mode === "burndown" ? (
          <path
            d={line(rows.map((r, i) => ({ x: xAt(i), y: yAt(r.guide) })))}
            fill="none"
            style={{ stroke: GUIDE }}
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d={line(rows.map((r, i) => ({ x: xAt(i), y: yAt(r.idealDone) })))}
              fill="none"
              style={{ stroke: GUIDE }}
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            <path
              d={line(rows.map((r, i) => ({ x: xAt(i), y: yAt(r.scope) })))}
              fill="none"
              style={{ stroke: NEUTRAL }}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </>
        )}
        {primary.length > 0 && (
          <>
            <path style={{ stroke: accent }} d={line(primary)} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle
              style={{ fill: accent, stroke: SURFACE }}
              cx={primary[primary.length - 1].x}
              cy={primary[primary.length - 1].y}
              r="4.5"
              strokeWidth="2"
            />
          </>
        )}
        {hover !== null && (
          <line style={{ stroke: GUIDE }} x1={xAt(hover)} x2={xAt(hover)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} strokeWidth="1" />
        )}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
          onMouseMove={(e) => setHover(nearestIndex(e, points.length, MARGIN.left, PLOT_WIDTH, xAt))}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hovered && hover !== null && (
        <HoverCard
          leftPct={(xAt(hover) / WIDTH) * 100}
          title={`${format(hovered.date, "EEE, MMM d")}${hover === 0 ? " · start" : hover === last ? " · end" : ""}`}
          rows={
            mode === "burndown"
              ? [
                  { label: "Remaining", value: fmt(hovered.remaining), color: accent, kind: "line" },
                  { label: "Guideline", value: fmt(hovered.guide), color: GUIDE, kind: "dash" },
                ]
              : [
                  { label: "Completed", value: fmt(hovered.completed), color: accent, kind: "line" },
                  { label: "Scope", value: fmt(hovered.scope), color: NEUTRAL, kind: "line" },
                  { label: "Ideal pace", value: fmt(hovered.idealDone), color: GUIDE, kind: "dash" },
                ]
          }
        />
      )}
    </div>
  );

  return (
    <ReportCard
      title="Burndown and burnup"
      description="Work left against the guideline, or work done climbing toward the sprint's scope."
      headline={
        <Headline
          label={mode === "burndown" ? "Remaining" : "Completed"}
          value={mode === "burndown" ? left : done}
          unit={u}
          detail={`${pct}% of ${scopeNow} ${u} done`}
          figures={[
            {
              label: "Scope change",
              value: scopeChange === 0 ? "None" : `${scopeChange > 0 ? "+" : "−"}${Math.abs(scopeChange)}`,
              unit: scopeChange === 0 ? undefined : u,
            },
            { label: "Committed", value: rows[0]?.scope ?? 0, unit: u },
          ]}
        />
      }
      legend={<Legend items={legend} />}
      controls={
        <>
          <Segmented
            label="Chart"
            value={mode}
            onChange={setMode}
            options={[
              { value: "burndown", label: "Burndown" },
              { value: "burnup", label: "Burnup" },
            ]}
          />
          <Segmented label="Unit" value={metric} onChange={setMetric} options={UNIT_OPTIONS} />
        </>
      }
      chart={chart}
      table={
        <DataTable
          caption={`Sprint ${mode} by day, in ${issues ? "issues" : "story points"}`}
          columns={[
            { label: "Day" },
            { label: "Remaining", numeric: true },
            { label: "Guideline", numeric: true },
            { label: "Completed", numeric: true },
            { label: "Scope", numeric: true },
          ]}
          rows={rows.map((r, i) => ({
            key: String(i),
            cells: [format(r.date, "EEE, MMM d"), r.remaining ?? "–", Math.round(r.guide), r.completed ?? "–", r.scope],
          }))}
        />
      }
    />
  );
}
