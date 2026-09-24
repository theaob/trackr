"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Layers, Loader2 } from "lucide-react";
import { useChartWidth } from "@/hooks/useChartWidth";
import type { CFDResult, CFDDataPoint } from "@/lib/cfd";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { niceAxis } from "./chartScale";
import {
  DataTable,
  EmptyChart,
  GUIDE,
  Headline,
  HoverCard,
  Legend,
  nearestIndex,
  ReportCard,
  Segmented,
  SURFACE,
  unitShort,
  YGrid,
  type Unit,
} from "./kit";

interface CumulativeFlowChartProps {
  initialData: CFDResult | null;
  onTimeframeChange?: (days: number) => void;
  selectedDays?: number;
  isLoading?: boolean;
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 40 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

/**
 * How much work sat in each workflow status, day by day. It leads with the
 * average lead time, creation to done, beside throughput and work in progress.
 */
export default function CumulativeFlowChart({
  initialData,
  onTimeframeChange,
  selectedDays = 30,
  isLoading = false,
}: CumulativeFlowChartProps) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [metric, setMetric] = useState<Unit>("issues");
  const [hover, setHover] = useState<number | null>(null);
  const issues = metric === "issues";
  const u = unitShort(metric);
  const points = useMemo(() => initialData?.points ?? [], [initialData?.points]);
  const metrics = initialData?.metrics;

  // One band per workflow status, in its own colour, bottom to top as stacked.
  // Older data without per-status totals falls back to the three categories.
  const bands = useMemo(() => {
    const all: { key: string; label: string; color: string; value: (p: CFDDataPoint) => number }[] =
      initialData?.statuses && initialData.statuses.length > 0
        ? initialData.statuses.map((st) => ({
            key: st.name,
            label: prettifyStatusName(st.name),
            color: st.color,
            value: (p: CFDDataPoint) => {
              const t = p.byStatus?.[st.name];
              return t ? (issues ? t.count : t.points) : 0;
            },
          }))
        : (initialData?.categories ?? []).map((cat) => ({
            key: cat.key,
            label: cat.label,
            color: cat.color,
            value: (p: CFDDataPoint) => (issues ? p.counts[cat.key] : p.points[cat.key]),
          }));
    return all.filter((b) => points.some((p) => b.value(p) > 0));
  }, [initialData?.statuses, initialData?.categories, points, issues]);

  const last = Math.max(1, points.length - 1);
  const { ticks, axisMax } = niceAxis(Math.max(1, ...points.map((p) => (issues ? p.totalIssues : p.totalPoints))));
  const xAt = (i: number) => (points.length > 1 ? MARGIN.left + (i / last) * PLOT_WIDTH : MARGIN.left + PLOT_WIDTH / 2);
  const yAt = (v: number) => MARGIN.top + PLOT_HEIGHT - (v / axisMax) * PLOT_HEIGHT;

  const shapes = useMemo(() => {
    if (points.length < 2) return [];
    const base = points.map(() => 0);
    return bands.map((b) => {
      const c = points.map((p, i) => {
        const y0 = base[i];
        base[i] += b.value(p);
        return { x: xAt(i), y0: yAt(y0), y1: yAt(base[i]) };
      });
      const top = c.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y1}`).join(" ");
      const bottom = c
        .slice()
        .reverse()
        .map((p) => `L ${p.x} ${p.y0}`)
        .join(" ");
      return { key: b.key, color: b.color, area: `${top} ${bottom} Z`, top };
    });
    // xAt and yAt only change with the width and axis, which these inputs cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, bands, WIDTH, axisMax]);

  const timeframe = (
    <Segmented
      label="Time window"
      value={String(selectedDays)}
      onChange={(v) => onTimeframeChange?.(Number(v))}
      options={[
        { value: "14", label: "14 days" },
        { value: "30", label: "30 days" },
        { value: "90", label: "90 days" },
      ]}
    />
  );
  const unit = (
    <Segmented
      label="Unit"
      value={metric}
      onChange={setMetric}
      options={[
        { value: "issues", label: "Issues" },
        { value: "points", label: "Story points" },
      ]}
    />
  );

  const hovered = hover !== null ? points[hover] : null;
  const topDown = bands.slice().reverse();

  const chart =
    !initialData || points.length === 0 ? (
      <EmptyChart icon={<Layers aria-hidden="true" />}>No activity to plot yet.</EmptyChart>
    ) : (
      <div className="relative" ref={chartRef}>
        {isLoading && (
          <p className="absolute right-0 top-0 flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Updating…
          </p>
        )}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Cumulative flow diagram. The table view lists every day."
        >
          <YGrid ticks={ticks} yAt={yAt} x1={MARGIN.left} x2={WIDTH - MARGIN.right} />
          {shapes.map((s) => (
            <g key={s.key}>
              <path style={{ fill: s.color }} d={s.area} fillOpacity="0.85" />
              {/* A 2px surface line between bands keeps neighbours apart. */}
              <path style={{ stroke: SURFACE }} d={s.top} fill="none" strokeWidth="2" strokeLinejoin="round" />
            </g>
          ))}
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
            title={format(hovered.date, "EEE, MMM d")}
            rows={topDown.map((b) => ({ label: b.label, value: `${b.value(hovered)} ${u}`, color: b.color }))}
            footer={{ label: "Total", value: `${issues ? hovered.totalIssues : hovered.totalPoints} ${u}` }}
          />
        )}
      </div>
    );

  return (
    <ReportCard
      title="Cumulative flow"
      description="Work in each status over time. A widening band is where work is piling up."
      headline={
        metrics ? (
          <Headline
            label="Average lead time"
            value={metrics.avgLeadTimeDays !== null ? metrics.avgLeadTimeDays : "–"}
            unit={metrics.avgLeadTimeDays !== null ? "days" : undefined}
            detail="From creation to done, for issues finished in this window"
            figures={[
              { label: "Throughput", value: metrics.throughputPerWeek, unit: "issues a week" },
              { label: "In progress now", value: issues ? metrics.currentWipIssues : metrics.currentWipPoints, unit: u },
              { label: `Done in ${selectedDays} days`, value: metrics.totalCompletedInWindow, unit: "issues" },
            ]}
          />
        ) : undefined
      }
      legend={<Legend items={topDown.map((b) => ({ label: b.label, color: b.color }))} />}
      controls={
        <>
          {timeframe}
          {unit}
        </>
      }
      chart={chart}
      table={
        <DataTable
          caption={`Work in each status by day, in ${issues ? "issues" : "story points"}`}
          columns={[{ label: "Day" }, ...topDown.map((b) => ({ label: b.label, numeric: true })), { label: "Total", numeric: true }]}
          rows={points.map((p, i) => ({
            key: String(i),
            cells: [format(p.date, "EEE, MMM d"), ...topDown.map((b) => b.value(p)), issues ? p.totalIssues : p.totalPoints],
          }))}
        />
      }
    />
  );
}
