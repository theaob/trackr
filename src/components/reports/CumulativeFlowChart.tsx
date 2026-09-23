"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useChartWidth } from "@/hooks/useChartWidth";
import { format } from "date-fns";
import { Layers, Clock, Activity, Zap, CheckCircle2 } from "lucide-react";
import type { CFDResult, CFDDataPoint } from "@/lib/cfd";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { niceAxis } from "./chartScale";

interface CumulativeFlowChartProps {
  initialData: CFDResult | null;
  onTimeframeChange?: (days: number) => void;
  selectedDays?: number;
  isLoading?: boolean;
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 280;
const MARGIN = { top: 28, right: 28, bottom: 32, left: 44 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export default function CumulativeFlowChart({
  initialData,
  onTimeframeChange,
  selectedDays = 30,
  isLoading = false,
}: CumulativeFlowChartProps) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [metricUnit, setMetricUnit] = useState<"issues" | "points">("issues");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => initialData?.points ?? [], [initialData?.points]);
  const metrics = initialData?.metrics;
  const isIssueUnit = metricUnit === "issues";

  const maxVal = useMemo(() => {
    if (points.length === 0) return 1;
    return Math.max(
      ...points.map((p) => (isIssueUnit ? p.totalIssues : p.totalPoints)),
      1
    );
  }, [points, isIssueUnit]);

  const { ticks, axisMax: yMax } = useMemo(() => niceAxis(maxVal), [maxVal]);

  const xAt = useCallback(
    (index: number) =>
      points.length > 1
        ? MARGIN.left + (index / (points.length - 1)) * PLOT_WIDTH
        : MARGIN.left + PLOT_WIDTH / 2,
    [points.length, PLOT_WIDTH]
  );

  const yAt = useCallback(
    (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT,
    [yMax]
  );

  // One series per workflow status, in its configured color, listed
  // bottom-to-top as stacked. Older data without per-status totals falls back
  // to the three categories.
  const series = useMemo(() => {
    const all: { key: string; label: string; color: string; value: (p: CFDDataPoint) => number }[] =
      initialData?.statuses && initialData.statuses.length > 0
        ? initialData.statuses.map((st) => ({
            key: st.name,
            label: prettifyStatusName(st.name),
            color: st.color,
            value: (p: CFDDataPoint) => {
              const totals = p.byStatus?.[st.name];
              return totals ? (isIssueUnit ? totals.count : totals.points) : 0;
            },
          }))
        : (initialData?.categories ?? []).map((cat) => ({
            key: cat.key,
            label: cat.label,
            color: cat.color,
            value: (p: CFDDataPoint) => (isIssueUnit ? p.counts[cat.key] : p.points[cat.key]),
          }));
    // Leave out statuses that hold nothing in this window.
    return all.filter((s) => points.some((p) => s.value(p) > 0));
  }, [initialData?.statuses, initialData?.categories, points, isIssueUnit]);

  const stackedBands = useMemo(() => {
    if (points.length < 2) return [];

    const makeAreaPath = (coords: { x: number; y0: number; y1: number }[]) => {
      const topPath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y1}`).join(" ");
      const bottomPath = coords
        .slice()
        .reverse()
        .map((c) => `L ${c.x} ${c.y0}`)
        .join(" ");
      return `${topPath} ${bottomPath} Z`;
    };

    const makeTopStrokePath = (coords: { x: number; y1: number }[]) => {
      return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y1}`).join(" ");
    };

    const base = points.map(() => 0);
    return series.map((s) => {
      const coords = points.map((p, i) => {
        const y0 = base[i];
        base[i] += s.value(p);
        return { x: xAt(i), y0: yAt(y0), y1: yAt(base[i]) };
      });
      return {
        key: s.key,
        fill: s.color,
        stroke: s.color,
        areaPath: makeAreaPath(coords),
        strokePath: makeTopStrokePath(coords),
      };
    });
  }, [points, series, xAt, yAt]);

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // The hit area covers just the plot, so map across the plot's width.
    const relX = MARGIN.left + ((e.clientX - rect.left) / rect.width) * PLOT_WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipLeft = hoverIndex !== null ? (xAt(hoverIndex) / WIDTH) * 100 : 0;
  const tooltipAlignRight = tooltipLeft > 65;
  const unitLabel = isIssueUnit ? "issues" : "pts";

  if (!initialData || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <Layers className="w-8 h-8" />
        <p className="text-xs">No historical activity data yet for Cumulative Flow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jira-gray-200 pb-3">
        {/* Timeframe Filter Pills */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          {[
            { days: 14, label: "14 Days" },
            { days: 30, label: "30 Days" },
            { days: 90, label: "90 Days" },
          ].map((item) => (
            <button
              key={item.days}
              type="button"
              onClick={() => onTimeframeChange?.(item.days)}
              className={`px-3 py-1 rounded font-medium transition-all ${
                selectedDays === item.days
                  ? "bg-white text-jira-navy shadow-2xs font-semibold"
                  : "text-jira-gray-600 hover:text-jira-navy"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Legend: workflow order, matching the stack from the top down */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-jira-gray-600">
          {series
            .slice()
            .reverse()
            .map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          <button
            type="button"
            onClick={() => setMetricUnit("issues")}
            className={`px-2.5 py-0.5 rounded font-medium transition-all ${
              isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Issues
          </button>
          <button
            type="button"
            onClick={() => setMetricUnit("points")}
            className={`px-2.5 py-0.5 rounded font-medium transition-all ${
              !isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Story Points
          </button>
        </div>
      </div>

      {/* Flow KPI Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-jira-gray-500 uppercase">
              <Activity className="w-3.5 h-3.5 text-jira-blue" />
              <span>Current WIP</span>
            </div>
            <div className="text-xl font-bold text-jira-blue mt-1">
              {isIssueUnit ? metrics.currentWipIssues : metrics.currentWipPoints}{" "}
              <span className="text-xs font-normal text-jira-gray-500">{unitLabel}</span>
            </div>
            <div className="text-[10px] text-jira-gray-500 mt-0.5">Active in progress right now</div>
          </div>

          <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-jira-gray-500 uppercase">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Throughput</span>
            </div>
            <div className="text-xl font-bold text-jira-navy mt-1">
              {metrics.throughputPerWeek}{" "}
              <span className="text-xs font-normal text-jira-gray-500">issues / week</span>
            </div>
            <div className="text-[10px] text-jira-gray-500 mt-0.5">Rolling completion rate</div>
          </div>

          <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-jira-gray-500 uppercase">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Avg Lead Time</span>
            </div>
            <div className="text-xl font-bold text-jira-navy mt-1">
              {metrics.avgLeadTimeDays !== null ? `${metrics.avgLeadTimeDays}d` : "—"}
            </div>
            <div className="text-[10px] text-jira-gray-500 mt-0.5">Creation to resolution</div>
          </div>

          <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-jira-gray-500 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Total Delivered</span>
            </div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {metrics.totalCompletedInWindow}{" "}
              <span className="text-xs font-normal text-jira-gray-500">issues</span>
            </div>
            <div className="text-[10px] text-jira-gray-500 mt-0.5">Completed in last {selectedDays} days</div>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative" ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Cumulative flow diagram"
        >
          {/* Y Axis Gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#EBECF0"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 8}
                y={yAt(t) + 3}
                textAnchor="end"
                className="fill-jira-gray-500"
                fontSize="10"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Stacked Filled Area Bands */}
          {stackedBands.map((band) => (
            <g key={band.key}>
              <path d={band.areaPath} fill={band.fill} fillOpacity="0.8" />
              <path d={band.strokePath} fill="none" stroke={band.stroke} strokeWidth="1.5" />
            </g>
          ))}

          {/* X Axis Date Labels */}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i, idx) => (
            <text
              key={`${i}-${idx}`}
              x={xAt(i)}
              y={HEIGHT - 8}
              textAnchor={idx === 0 ? "start" : idx === 2 ? "end" : "middle"}
              className="fill-jira-gray-500"
              fontSize="10"
            >
              {format(points[i].date, "MMM d")}
            </text>
          ))}

          {/* Hover Crosshair */}
          {hoverIndex !== null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#091E42"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* Transparent Hover Hit Area */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={PLOT_WIDTH}
            height={PLOT_HEIGHT}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          />
        </svg>

        {/* Floating Tooltip */}
        {hovered && (
          <div
            className="absolute top-2 pointer-events-none bg-jira-navy text-white text-[11px] rounded-md px-3 py-2 shadow-xl z-20 whitespace-nowrap border border-white/10"
            style={{
              left: `${tooltipLeft}%`,
              transform: tooltipAlignRight ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            <div className="font-bold text-white mb-1.5 border-b border-white/20 pb-1">
              {format(hovered.date, "EEEE, MMM d, yyyy")}
            </div>
            <div className="space-y-1">
              {series
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}:
                    </span>
                    <span className="font-bold text-white">
                      {s.value(hovered)} {unitLabel}
                    </span>
                  </div>
                ))}
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10 text-jira-gray-300">
                <span>Total Work:</span>
                <span className="font-bold text-white">
                  {isIssueUnit ? hovered.totalIssues : hovered.totalPoints} {unitLabel}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
