"use client";

import React, { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { useChartWidth } from "@/hooks/useChartWidth";
import { niceAxis } from "./chartScale";
import {
  DataTable,
  EmptyChart,
  GUIDE,
  Headline,
  HoverCard,
  Legend,
  ReportCard,
  Segmented,
  series,
  UNIT_OPTIONS,
  unitShort,
  YGrid,
  type Unit,
} from "./kit";

export interface VelocitySprint {
  id: string;
  name: string;
  points?: number; // legacy
  completedPoints?: number;
  committedPoints?: number;
  issueCount?: number; // legacy
  completedIssues?: number;
  committedIssues?: number;
  reliabilityPct?: number;
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 260;
const MARGIN = { top: 20, right: 24, bottom: 30, left: 40 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const MAX_BAR = 24;
const GAP = 2;

/** A bar with a 4px rounded top and a square foot on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h} Z`;
}

/**
 * Committed against completed work per sprint. It leads with the average
 * completed per sprint and how much of the commitment was delivered.
 */
export default function VelocityChart({ sprints }: { sprints: VelocitySprint[] }) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [metric, setMetric] = useState<Unit>("points");
  const [hover, setHover] = useState<number | null>(null);
  const issues = metric === "issues";
  const u = unitShort(metric);

  const rows = useMemo(
    () =>
      sprints.map((s) => {
        const completedPts = s.completedPoints ?? s.points ?? 0;
        const committedPts = s.committedPoints ?? completedPts;
        const completedIss = s.completedIssues ?? s.issueCount ?? 0;
        const committedIss = s.committedIssues ?? completedIss;
        const reliability =
          s.reliabilityPct ??
          (committedPts > 0 ? Math.min(100, Math.round((completedPts / committedPts) * 100)) : completedIss > 0 ? 100 : 0);
        return {
          id: s.id,
          name: s.name,
          committed: issues ? committedIss : committedPts,
          completed: issues ? completedIss : completedPts,
          reliability,
        };
      }),
    [sprints, issues]
  );

  const average = rows.length ? Math.round(rows.reduce((a, r) => a + r.completed, 0) / rows.length) : 0;
  const reliability = rows.length ? Math.round(rows.reduce((a, r) => a + r.reliability, 0) / rows.length) : 0;
  const { ticks, axisMax } = niceAxis(Math.max(1, ...rows.map((r) => Math.max(r.committed, r.completed))));
  const yAt = (v: number) => MARGIN.top + PLOT_HEIGHT - (v / axisMax) * PLOT_HEIGHT;
  const slot = PLOT_WIDTH / Math.max(1, rows.length);
  const bar = Math.max(4, Math.min(MAX_BAR, (slot - 16) / 2));
  const committedColor = series("1-soft");
  const completedColor = series(1);

  const chart =
    rows.length === 0 ? (
      <EmptyChart icon={<Gauge aria-hidden="true" />}>Complete a sprint to start tracking velocity.</EmptyChart>
    ) : (
      <div className="relative" ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Velocity chart. The table view lists every sprint."
        >
          <YGrid ticks={ticks} yAt={yAt} x1={MARGIN.left} x2={WIDTH - MARGIN.right} />
          {rows.map((r, i) => {
            const center = MARGIN.left + (i + 0.5) * slot;
            const base = yAt(0);
            return (
              <g key={r.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect
                  style={{ fill: hover === i ? "rgb(var(--color-surface-sunk))" : "transparent" }}
                  x={center - slot / 2}
                  y={MARGIN.top}
                  width={slot}
                  height={PLOT_HEIGHT}
                />
                {r.committed > 0 && (
                  <path
                    style={{ fill: committedColor }}
                    d={barPath(center - bar - GAP / 2, yAt(r.committed), bar, base - yAt(r.committed))}
                  />
                )}
                {r.completed > 0 && (
                  <path style={{ fill: completedColor }} d={barPath(center + GAP / 2, yAt(r.completed), bar, base - yAt(r.completed))} />
                )}
                {r.completed > 0 && (
                  <text
                    x={center + GAP / 2 + bar / 2}
                    y={yAt(r.completed) - 5}
                    textAnchor="middle"
                    className="fill-ink-2 tabular-nums"
                    fontSize="11"
                  >
                    {r.completed}
                  </text>
                )}
                <text x={center} y={HEIGHT - 10} textAnchor="middle" className={hover === i ? "fill-ink" : "fill-muted"} fontSize="11">
                  {r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name}
                </text>
              </g>
            );
          })}
          {average > 0 && (
            <g aria-hidden="true">
              <line
                style={{ stroke: GUIDE }}
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yAt(average)}
                y2={yAt(average)}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text x={WIDTH - MARGIN.right} y={yAt(average) - 5} textAnchor="end" className="fill-ink-2" fontSize="11">
                Average {average}
              </text>
            </g>
          )}
        </svg>
        {hover !== null && rows[hover] && (
          <HoverCard
            leftPct={((MARGIN.left + (hover + 0.5) * slot) / WIDTH) * 100}
            title={rows[hover].name}
            rows={[
              { label: "Committed", value: `${rows[hover].committed} ${u}`, color: committedColor },
              { label: "Completed", value: `${rows[hover].completed} ${u}`, color: completedColor },
            ]}
            footer={{ label: "Delivered", value: `${rows[hover].reliability}%` }}
          />
        )}
      </div>
    );

  return (
    <ReportCard
      title="Velocity"
      description="Work committed at the start of each sprint against work completed by its end."
      headline={
        <Headline
          label="Average velocity"
          value={average}
          unit={`${u} per sprint`}
          detail={rows.length ? `Over the last ${rows.length} sprint${rows.length === 1 ? "" : "s"}` : undefined}
          figures={[{ label: "Commitment delivered", value: `${reliability}%` }]}
        />
      }
      legend={
        <Legend
          items={[
            { label: "Committed", color: committedColor },
            { label: "Completed", color: completedColor },
            { label: "Average", color: GUIDE, kind: "dash" },
          ]}
        />
      }
      controls={<Segmented label="Unit" value={metric} onChange={setMetric} options={UNIT_OPTIONS} />}
      chart={chart}
      table={
        <DataTable
          caption={`Velocity by sprint, in ${issues ? "issues" : "story points"}`}
          columns={[
            { label: "Sprint" },
            { label: "Committed", numeric: true },
            { label: "Completed", numeric: true },
            { label: "Delivered", numeric: true },
          ]}
          rows={rows.map((r) => ({ key: r.id, cells: [r.name, r.committed, r.completed, `${r.reliability}%`] }))}
        />
      }
    />
  );
}
