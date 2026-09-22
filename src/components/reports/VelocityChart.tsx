"use client";

import React, { useMemo, useState } from "react";
import { useChartWidth } from "@/hooks/useChartWidth";
import { Gauge, CheckCircle2, TrendingUp, HelpCircle } from "lucide-react";
import { niceAxis } from "./chartScale";

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

interface VelocityChartProps {
  sprints: VelocitySprint[];
}

// Narrowest drawing width; wider containers draw at their real width.
const BASE_WIDTH = 680;
const HEIGHT = 280;
const MARGIN = { top: 32, right: 28, bottom: 36, left: 44 };
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const MAX_BAR_WIDTH = 26;

export default function VelocityChart({ sprints }: VelocityChartProps) {
  const [chartRef, WIDTH] = useChartWidth(BASE_WIDTH);
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const [metricUnit, setMetricUnit] = useState<"points" | "issues">("points");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isIssueUnit = metricUnit === "issues";

  const normalizedSprints = useMemo(() => {
    return sprints.map((s) => {
      const completedPts = s.completedPoints ?? s.points ?? 0;
      const committedPts = s.committedPoints ?? completedPts;
      const completedIss = s.completedIssues ?? s.issueCount ?? 0;
      const committedIss = s.committedIssues ?? completedIss;
      const reliability =
        s.reliabilityPct ??
        (committedPts > 0
          ? Math.min(100, Math.round((completedPts / committedPts) * 100))
          : completedIss > 0
          ? 100
          : 0);

      return {
        ...s,
        completedPts,
        committedPts,
        completedIss,
        committedIss,
        reliability,
      };
    });
  }, [sprints]);

  const maxVal = useMemo(() => {
    return Math.max(
      ...normalizedSprints.map((s) =>
        isIssueUnit
          ? Math.max(s.committedIss, s.completedIss)
          : Math.max(s.committedPts, s.completedPts)
      ),
      1
    );
  }, [normalizedSprints, isIssueUnit]);

  const { ticks, axisMax: yMax } = useMemo(() => niceAxis(maxVal), [maxVal]);

  const avgCompleted = useMemo(() => {
    if (normalizedSprints.length === 0) return 0;
    const sum = normalizedSprints.reduce(
      (acc, s) => acc + (isIssueUnit ? s.completedIss : s.completedPts),
      0
    );
    return Math.round(sum / normalizedSprints.length);
  }, [normalizedSprints, isIssueUnit]);

  const avgReliability = useMemo(() => {
    if (normalizedSprints.length === 0) return 0;
    const sum = normalizedSprints.reduce((acc, s) => acc + s.reliability, 0);
    return Math.round(sum / normalizedSprints.length);
  }, [normalizedSprints]);

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <Gauge className="w-8 h-8" />
        <p className="text-xs">Complete a sprint to start tracking velocity.</p>
      </div>
    );
  }

  const slotWidth = PLOT_WIDTH / normalizedSprints.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, (slotWidth - 12) / 2);
  const yAt = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;

  const unitLabel = isIssueUnit ? "issues" : "pts";

  return (
    <div className="space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jira-gray-200 pb-3">
        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-jira-gray-600">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-xs bg-[#4C9AFF]" />
            Committed
          </span>
          <span className="flex items-center gap-1.5 font-medium text-jira-blue">
            <span className="w-3 h-3 rounded-xs bg-[#0052CC]" />
            Completed
          </span>
          {avgCompleted > 0 && (
            <span className="flex items-center gap-1.5 text-jira-gray-500">
              <svg width="14" height="8">
                <line x1="0" y1="4" x2="14" y2="4" stroke="#8993A4" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              Avg: {avgCompleted} {unitLabel}
            </span>
          )}
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          <button
            type="button"
            onClick={() => setMetricUnit("points")}
            className={`px-2.5 py-0.5 rounded font-medium transition-all ${
              !isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Story Points
          </button>
          <button
            type="button"
            onClick={() => setMetricUnit("issues")}
            className={`px-2.5 py-0.5 rounded font-medium transition-all ${
              isIssueUnit ? "bg-white text-jira-navy shadow-2xs font-semibold" : "text-jira-gray-600"
            }`}
          >
            Issue Count
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-md p-3">
          <div className="text-[10px] font-bold text-jira-gray-500 uppercase">Average Velocity</div>
          <div className="text-xl font-bold text-jira-navy mt-0.5">
            {avgCompleted} <span className="text-xs font-normal text-jira-gray-500">{unitLabel} / sprint</span>
          </div>
        </div>
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-md p-3">
          <div className="text-[10px] font-bold text-jira-gray-500 uppercase">Commitment Reliability</div>
          <div className="text-xl font-bold text-jira-navy mt-0.5">
            {avgReliability}% <span className="text-xs font-normal text-jira-gray-500">completed vs planned</span>
          </div>
        </div>
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-md p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold text-jira-gray-500 uppercase">Sprints Evaluated</div>
          <div className="text-xl font-bold text-jira-navy mt-0.5">
            {normalizedSprints.length} <span className="text-xs font-normal text-jira-gray-500">sprints</span>
          </div>
        </div>
      </div>

      {/* SVG Dual-Bar Chart */}
      <div className="relative" ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Sprint velocity chart"
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

          {/* Average reference line */}
          {avgCompleted > 0 && (
            <>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yAt(avgCompleted)}
                y2={yAt(avgCompleted)}
                stroke="#8993A4"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={WIDTH - MARGIN.right}
                y={yAt(avgCompleted) - 4}
                textAnchor="end"
                className="fill-jira-gray-500 font-semibold"
                fontSize="10"
              >
                avg {avgCompleted}
              </text>
            </>
          )}

          {/* Sprint Grouped Bars */}
          {normalizedSprints.map((s, i) => {
            const slotStart = MARGIN.left + i * slotWidth;
            const groupCenter = slotStart + slotWidth / 2;

            const committedVal = isIssueUnit ? s.committedIss : s.committedPts;
            const completedVal = isIssueUnit ? s.completedIss : s.completedPts;

            const committedBarX = groupCenter - barWidth - 1.5;
            const completedBarX = groupCenter + 1.5;

            const committedTop = yAt(committedVal);
            const committedHeight = Math.max(0, MARGIN.top + PLOT_HEIGHT - committedTop);

            const completedTop = yAt(completedVal);
            const completedHeight = Math.max(0, MARGIN.top + PLOT_HEIGHT - completedTop);

            const isHovered = hoverIndex === i;

            return (
              <g
                key={s.id}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              >
                {/* Hover Background Column Highlight */}
                {isHovered && (
                  <rect
                    x={slotStart + 4}
                    y={MARGIN.top}
                    width={slotWidth - 8}
                    height={PLOT_HEIGHT}
                    fill="#0052CC"
                    fillOpacity="0.04"
                    rx="4"
                  />
                )}

                {/* Committed Bar (Light Blue) */}
                <rect
                  x={committedBarX}
                  y={committedTop}
                  width={barWidth}
                  height={committedHeight}
                  rx="3"
                  fill={isHovered ? "#2684FF" : "#4C9AFF"}
                  className="transition-colors"
                />

                {/* Completed Bar (Solid Jira Blue) */}
                <rect
                  x={completedBarX}
                  y={completedTop}
                  width={barWidth}
                  height={completedHeight}
                  rx="3"
                  fill={isHovered ? "#0047B3" : "#0052CC"}
                  className="transition-colors"
                />

                {/* Value labels on top of bars */}
                {committedVal > 0 && (
                  <text
                    x={committedBarX + barWidth / 2}
                    y={committedTop - 4}
                    textAnchor="middle"
                    className="fill-jira-gray-600 font-medium"
                    fontSize="9"
                  >
                    {committedVal}
                  </text>
                )}

                {completedVal > 0 && (
                  <text
                    x={completedBarX + barWidth / 2}
                    y={completedTop - 4}
                    textAnchor="middle"
                    className="fill-jira-navy font-bold"
                    fontSize="9"
                  >
                    {completedVal}
                  </text>
                )}

                {/* X-axis Sprint Label */}
                <text
                  x={groupCenter}
                  y={HEIGHT - 12}
                  textAnchor="middle"
                  className={`text-[10px] ${
                    isHovered ? "fill-jira-blue font-bold" : "fill-jira-gray-600 font-medium"
                  }`}
                  fontSize="10"
                >
                  {s.name.length > 12 ? `${s.name.slice(0, 10)}…` : s.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoverIndex !== null && normalizedSprints[hoverIndex] && (
          <div
            className="absolute top-2 pointer-events-none bg-jira-navy text-white text-[11px] rounded-md px-3 py-2 shadow-xl z-20 whitespace-nowrap border border-white/10"
            style={{
              left: `${((MARGIN.left + (hoverIndex + 0.5) * slotWidth) / WIDTH) * 100}%`,
              transform: hoverIndex > normalizedSprints.length / 2 ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            <div className="font-bold text-white mb-1.5 border-b border-white/20 pb-1">
              {normalizedSprints[hoverIndex].name}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4C9AFF]" />
                  Committed:
                </span>
                <span className="font-bold text-white">
                  {isIssueUnit
                    ? normalizedSprints[hoverIndex].committedIss
                    : normalizedSprints[hoverIndex].committedPts}{" "}
                  {unitLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0052CC]" />
                  Completed:
                </span>
                <span className="font-bold text-emerald-400">
                  {isIssueUnit
                    ? normalizedSprints[hoverIndex].completedIss
                    : normalizedSprints[hoverIndex].completedPts}{" "}
                  {unitLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10 text-jira-gray-300">
                <span>Reliability:</span>
                <span className="font-bold text-white">
                  {normalizedSprints[hoverIndex].reliability}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
