"use client";

import React, { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { TrendingDown } from "lucide-react";
import type { BurndownPoint } from "@/lib/burndown";
import { niceAxis } from "./chartScale";

interface BurndownChartProps {
  points: BurndownPoint[];
  totalPoints: number;
  unit?: string;
}

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 24, right: 24, bottom: 28, left: 44 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export default function BurndownChart({ points, totalPoints, unit }: BurndownChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { ticks, axisMax: yMax } = useMemo(() => niceAxis(Math.max(totalPoints, 1)), [totalPoints]);

  const xAt = useCallback(
    (index: number) =>
      points.length > 1 ? MARGIN.left + (index / (points.length - 1)) * PLOT_WIDTH : MARGIN.left + PLOT_WIDTH / 2,
    [points.length]
  );
  const yAt = useCallback(
    (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT,
    [yMax]
  );

  const idealPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.ideal)}`).join(" ");

  const knownRemaining = points
    .map((p, i) => (p.remaining !== null ? { i, v: p.remaining } : null))
    .filter((p): p is { i: number; v: number } => p !== null);

  // Burndown starts at Sprint Start (xAt(0)) with total committed points.
  // Each day's remaining work is plotted at the end of that day.
  const remainingPoints = useMemo(() => {
    if (knownRemaining.length === 0) return [];

    const startVal = totalPoints > 0 ? totalPoints : knownRemaining[0].v;
    const pts: { x: number; y: number; v: number; i: number }[] = [
      { x: xAt(0), y: yAt(startVal), v: startVal, i: 0 },
    ];

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
  }, [knownRemaining, totalPoints, points.length, xAt, yAt]);

  const remainingPath = remainingPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const lastKnown = remainingPoints.length > 0 ? remainingPoints[remainingPoints.length - 1] : null;

  if (points.length < 2 || totalPoints === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <TrendingDown className="w-8 h-8" />
        <p className="text-xs">Not enough data yet to plot a burndown.</p>
      </div>
    );
  }

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
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

  let hoveredRemaining: number | null = null;
  if (hoverIndex !== null) {
    if (hoverIndex === 0) {
      hoveredRemaining = totalPoints > 0 ? totalPoints : (knownRemaining[0]?.v ?? null);
    } else {
      const prev = points[hoverIndex - 1];
      hoveredRemaining = prev ? prev.remaining : null;
    }
  }

  const labelX = lastKnown
    ? lastKnown.x <= MARGIN.left + 25
      ? lastKnown.x + 8
      : lastKnown.x >= WIDTH - MARGIN.right - 25
      ? lastKnown.x - 8
      : lastKnown.x
    : 0;

  const labelAnchor = lastKnown
    ? lastKnown.x <= MARGIN.left + 25
      ? "start"
      : lastKnown.x >= WIDTH - MARGIN.right - 25
      ? "end"
      : "middle"
    : "middle";

  const labelY = lastKnown ? Math.max(16, lastKnown.y - 8) : 0;
  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 text-[11px] text-jira-gray-600">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#8993A4" strokeWidth="2" strokeDasharray="3 3" /></svg>
          Guideline
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#0052CC" strokeWidth="2" /></svg>
          Remaining work
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto select-none" role="img" aria-label="Sprint burndown chart">
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
              <text x={MARGIN.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-jira-gray-500" fontSize="10">
                {t}
              </text>
            </g>
          ))}

          {/* X axis: first, middle, last date */}
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

          {/* Ideal guideline */}
          <path d={idealPath} fill="none" stroke="#8993A4" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

          {/* Actual remaining */}
          {remainingPath && (
            <path d={remainingPath} fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {lastKnown && (
            <>
              <circle cx={lastKnown.x} cy={lastKnown.y} r="5" fill="#0052CC" stroke="#FFFFFF" strokeWidth="2" />
              <text
                x={labelX}
                y={labelY}
                textAnchor={labelAnchor}
                className="fill-jira-navy font-semibold"
                fontSize="11"
              >
                {lastKnown.v}
              </text>
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
            />
          )}

          {/* Hover hit area */}
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

        {hovered && (
          <div
            className="absolute top-2 pointer-events-none bg-jira-navy text-white text-[11px] rounded-md px-2.5 py-1.5 shadow-lg z-10 whitespace-nowrap"
            style={{
              left: `${tooltipLeft}%`,
              transform: tooltipAlignRight ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            <div className="font-semibold mb-0.5">
              {format(hovered.date, "MMM d, yyyy")}
              {hoverIndex === 0 ? " (Start)" : ""}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8993A4] shrink-0" />
              <span>Guideline: {Math.round(hovered.ideal)}{unitSuffix}</span>
            </div>
            {hoveredRemaining !== null && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0052CC] shrink-0" />
                <span>Remaining: {hoveredRemaining}{unitSuffix}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
