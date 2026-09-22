"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useChartWidth } from "@/hooks/useChartWidth";
import { format } from "date-fns";
import { TrendingDown, TrendingUp, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import type { BurndownPoint } from "@/lib/burndown";
import { niceAxis } from "./chartScale";

interface BurndownChartProps {
  points: BurndownPoint[];
  totalPoints: number;
  totalIssues?: number;
  unit?: string;
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 280;
const MARGIN = { top: 28, right: 28, bottom: 32, left: 44 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export default function BurndownChart({
  points,
  totalPoints,
  totalIssues,
  unit,
}: BurndownChartProps) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [mode, setMode] = useState<"burndown" | "burnup">("burndown");
  const [metricUnit, setMetricUnit] = useState<"points" | "issues">(
    unit === "issues" ? "issues" : "points"
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isIssueUnit = metricUnit === "issues";

  // Effective max for Y axis
  const effectiveMax = useMemo(() => {
    if (isIssueUnit) {
      return Math.max(...points.map((p) => p.totalIssues || 0), totalIssues || 1);
    }
    return Math.max(...points.map((p) => p.scope || 0), totalPoints || 1);
  }, [points, isIssueUnit, totalIssues, totalPoints]);

  const { ticks, axisMax: yMax } = useMemo(
    () => niceAxis(Math.max(effectiveMax, 1)),
    [effectiveMax]
  );

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

  // Burndown paths
  const burndownIdealPath = points
    .map((p, i) => {
      const val = isIssueUnit
        ? (p.totalIssues || 1) * (1 - i / Math.max(1, points.length - 1))
        : p.ideal;
      return `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(val)}`;
    })
    .join(" ");

  const knownRemaining = points
    .map((p, i) => {
      const val = isIssueUnit ? p.remainingIssues : p.remaining;
      return val !== null ? { i, v: val } : null;
    })
    .filter((p): p is { i: number; v: number } => p !== null);

  const burndownRemainingPoints = useMemo(() => {
    if (knownRemaining.length === 0) return [];
    const startVal = isIssueUnit
      ? totalIssues ?? knownRemaining[0].v
      : totalPoints > 0
      ? totalPoints
      : knownRemaining[0].v;

    const pts = [{ x: xAt(0), y: yAt(startVal), v: startVal, i: 0 }];
    knownRemaining.forEach((k) => {
      const targetIndex = Math.min(k.i + 1, points.length - 1);
      pts.push({
        x: xAt(targetIndex),
        y: yAt(k.v),
        v: k.v,
        i: targetIndex,
      });
    });
    return pts;
  }, [knownRemaining, isIssueUnit, totalIssues, totalPoints, points.length, xAt, yAt]);

  const burndownRemainingPath = burndownRemainingPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Burnup paths
  const burnupScopePath = points
    .map((p, i) => {
      const val = isIssueUnit ? p.totalIssues : p.scope;
      return `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(val)}`;
    })
    .join(" ");

  const knownCompleted = points
    .map((p, i) => {
      const val = isIssueUnit ? p.completedIssues : p.completed;
      return val !== null ? { i, v: val } : null;
    })
    .filter((p): p is { i: number; v: number } => p !== null);

  const burnupCompletedPoints = useMemo(() => {
    if (knownCompleted.length === 0) return [];
    const pts = [{ x: xAt(0), y: yAt(0), v: 0, i: 0 }];
    knownCompleted.forEach((k) => {
      const targetIndex = Math.min(k.i + 1, points.length - 1);
      pts.push({
        x: xAt(targetIndex),
        y: yAt(k.v),
        v: k.v,
        i: targetIndex,
      });
    });
    return pts;
  }, [knownCompleted, points.length, xAt, yAt]);

  const burnupCompletedPath = burnupCompletedPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const burnupIdealPath = points
    .map((p, i) => {
      const total = isIssueUnit ? p.totalIssues || 1 : p.scope || 1;
      const val = total * (i / Math.max(1, points.length - 1));
      return `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(val)}`;
    })
    .join(" ");

  if (points.length < 2 || effectiveMax === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <TrendingDown className="w-8 h-8" />
        <p className="text-xs">Not enough data yet to plot a sprint timeline.</p>
      </div>
    );
  }

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

  const currentPoint = points.filter((p) => p.remaining !== null).pop() ?? points[0];
  const remainingValue = isIssueUnit
    ? currentPoint.remainingIssues ?? 0
    : currentPoint.remaining ?? 0;
  const completedValue = isIssueUnit
    ? currentPoint.completedIssues ?? 0
    : currentPoint.completed ?? 0;
  const scopeValue = isIssueUnit
    ? currentPoint.totalIssues ?? 0
    : currentPoint.scope ?? 0;

  const unitLabel = isIssueUnit ? "issues" : "pts";

  return (
    <div className="space-y-4">
      {/* Chart Top Controls & Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jira-gray-200 pb-3">
        {/* Mode Switcher: Burndown vs Burnup */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded-md border border-jira-gray-200">
          <button
            type="button"
            onClick={() => setMode("burndown")}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              mode === "burndown"
                ? "bg-white text-jira-blue shadow-2xs"
                : "text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Burndown</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("burnup")}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              mode === "burnup"
                ? "bg-white text-emerald-600 shadow-2xs"
                : "text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Burnup</span>
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-jira-gray-600">
          {mode === "burndown" ? (
            <>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="#8993A4" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
                Guideline
              </span>
              <span className="flex items-center gap-1.5 font-medium text-jira-blue">
                <svg width="16" height="8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="#0052CC" strokeWidth="2" />
                </svg>
                Remaining Work
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-medium text-jira-gray-700">
                <svg width="16" height="8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="#42526E" strokeWidth="2" />
                </svg>
                Total Scope
              </span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                <svg width="16" height="8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="#36B37E" strokeWidth="2" />
                </svg>
                Completed Work
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="#8993A4" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
                Ideal Pace
              </span>
            </>
          )}
        </div>

        {/* Unit Toggle: Story Points vs Issue Count */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          <button
            type="button"
            onClick={() => setMetricUnit("points")}
            className={`px-2 py-0.5 rounded font-medium transition-all ${
              !isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Story Points
          </button>
          <button
            type="button"
            onClick={() => setMetricUnit("issues")}
            className={`px-2 py-0.5 rounded font-medium transition-all ${
              isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Issue Count
          </button>
        </div>
      </div>

      {/* Metric Quick-Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-2.5">
          <div className="text-[10px] uppercase font-bold text-jira-gray-500">Committed Scope</div>
          <div className="text-base font-bold text-jira-navy mt-0.5">
            {scopeValue} <span className="text-xs font-normal text-jira-gray-500">{unitLabel}</span>
          </div>
        </div>
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-2.5">
          <div className="text-[10px] uppercase font-bold text-jira-gray-500">Completed</div>
          <div className="text-base font-bold text-emerald-600 mt-0.5">
            {completedValue} <span className="text-xs font-normal text-jira-gray-500">{unitLabel}</span>
          </div>
        </div>
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-2.5">
          <div className="text-[10px] uppercase font-bold text-jira-gray-500">Remaining</div>
          <div className="text-base font-bold text-jira-blue mt-0.5">
            {remainingValue} <span className="text-xs font-normal text-jira-gray-500">{unitLabel}</span>
          </div>
        </div>
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded p-2.5">
          <div className="text-[10px] uppercase font-bold text-jira-gray-500">Progress</div>
          <div className="text-base font-bold text-jira-navy mt-0.5">
            {scopeValue > 0 ? Math.round((completedValue / scopeValue) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative" ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={mode === "burndown" ? "Sprint burndown chart" : "Sprint burnup chart"}
        >
          {/* Subtle Background Fills */}
          {mode === "burndown" && burndownRemainingPath && (
            <path
              d={`${burndownRemainingPath} L ${xAt(Math.min(knownRemaining.length, points.length - 1))} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`}
              fill="#0052CC"
              fillOpacity="0.05"
            />
          )}

          {mode === "burnup" && burnupCompletedPath && (
            <path
              d={`${burnupCompletedPath} L ${xAt(Math.min(knownCompleted.length, points.length - 1))} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`}
              fill="#36B37E"
              fillOpacity="0.08"
            />
          )}

          {/* Gridlines */}
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

          {/* X Axis Dates */}
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

          {mode === "burndown" ? (
            <>
              {/* Burndown Ideal Guideline */}
              <path
                d={burndownIdealPath}
                fill="none"
                stroke="#8993A4"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              {/* Burndown Actual Remaining Curve */}
              {burndownRemainingPath && (
                <path
                  d={burndownRemainingPath}
                  fill="none"
                  stroke="#0052CC"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Current Value Marker */}
              {burndownRemainingPoints.length > 0 && (
                <circle
                  cx={burndownRemainingPoints[burndownRemainingPoints.length - 1].x}
                  cy={burndownRemainingPoints[burndownRemainingPoints.length - 1].y}
                  r="5"
                  fill="#0052CC"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              )}
            </>
          ) : (
            <>
              {/* Burnup Ideal Pace */}
              <path
                d={burnupIdealPath}
                fill="none"
                stroke="#8993A4"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
              {/* Burnup Scope Line */}
              <path
                d={burnupScopePath}
                fill="none"
                stroke="#42526E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Burnup Completed Work Curve */}
              {burnupCompletedPath && (
                <path
                  d={burnupCompletedPath}
                  fill="none"
                  stroke="#36B37E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Current Completed Value Marker */}
              {burnupCompletedPoints.length > 0 && (
                <circle
                  cx={burnupCompletedPoints[burnupCompletedPoints.length - 1].x}
                  cy={burnupCompletedPoints[burnupCompletedPoints.length - 1].y}
                  r="5"
                  fill="#36B37E"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              )}
            </>
          )}

          {/* Crosshair */}
          {hoverIndex !== null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#8993A4"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* Transparent Hover Interceptor */}
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

        {/* Hover Tooltip */}
        {hovered && (
          <div
            className="absolute top-2 pointer-events-none bg-jira-navy text-white text-[11px] rounded-md px-3 py-2 shadow-xl z-20 whitespace-nowrap border border-white/10"
            style={{
              left: `${tooltipLeft}%`,
              transform: tooltipAlignRight ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            <div className="font-bold text-white mb-1">
              {format(hovered.date, "MMM d, yyyy")}
              {hoverIndex === 0 ? " (Sprint Start)" : hoverIndex === points.length - 1 ? " (Sprint End)" : ""}
            </div>

            {mode === "burndown" ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#8993A4]" />
                  <span>Guideline:</span>
                  <span className="font-semibold text-jira-gray-200">
                    {Math.round(isIssueUnit ? (hovered.totalIssues || 1) * (1 - hoverIndex! / Math.max(1, points.length - 1)) : hovered.ideal)} {unitLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0052CC]" />
                  <span>Remaining:</span>
                  <span className="font-semibold text-white">
                    {(isIssueUnit ? hovered.remainingIssues : hovered.remaining) ?? "—"} {unitLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#42526E]" />
                  <span>Total Scope:</span>
                  <span className="font-semibold text-jira-gray-200">
                    {(isIssueUnit ? hovered.totalIssues : hovered.scope)} {unitLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#36B37E]" />
                  <span>Completed:</span>
                  <span className="font-semibold text-emerald-400">
                    {(isIssueUnit ? hovered.completedIssues : hovered.completed) ?? "—"} {unitLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
