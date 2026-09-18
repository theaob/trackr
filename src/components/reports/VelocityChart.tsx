"use client";

import React, { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { niceAxis } from "./chartScale";

interface VelocitySprint {
  id: string;
  name: string;
  points: number;
  issueCount: number;
}

interface VelocityChartProps {
  sprints: VelocitySprint[];
}

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 24, right: 16, bottom: 32, left: 40 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const MAX_BAR_WIDTH = 44;
const GAP = 2;

export default function VelocityChart({ sprints }: VelocityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxPoints = Math.max(...sprints.map((s) => s.points), 0);
  const { ticks, axisMax: yMax } = useMemo(() => niceAxis(maxPoints), [maxPoints]);
  const average = sprints.length
    ? sprints.reduce((sum, s) => sum + s.points, 0) / sprints.length
    : 0;

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <Gauge className="w-8 h-8" />
        <p className="text-xs">Complete a sprint to start tracking velocity.</p>
      </div>
    );
  }

  const slotWidth = PLOT_WIDTH / sprints.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth - GAP * 2);
  const yAt = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto select-none" role="img" aria-label="Velocity chart">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yAt(t)} y2={yAt(t)} stroke="#EBECF0" strokeWidth="1" />
              <text x={MARGIN.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-jira-gray-500" fontSize="10">
                {t}
              </text>
            </g>
          ))}

          {/* Average reference line */}
          {average > 0 && (
            <>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yAt(average)}
                y2={yAt(average)}
                stroke="#8993A4"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text x={WIDTH - MARGIN.right} y={yAt(average) - 4} textAnchor="end" className="fill-jira-gray-500" fontSize="10">
                avg {Math.round(average)}
              </text>
            </>
          )}

          {sprints.map((s, i) => {
            const slotStart = MARGIN.left + i * slotWidth;
            const barX = slotStart + (slotWidth - barWidth) / 2;
            const barTop = yAt(s.points);
            const barHeight = MARGIN.top + PLOT_HEIGHT - barTop;
            const isHovered = hoverIndex === i;

            return (
              <g key={s.id}>
                <rect
                  x={barX}
                  y={barHeight > 0 ? barTop : MARGIN.top + PLOT_HEIGHT}
                  width={barWidth}
                  height={Math.max(0, barHeight)}
                  rx="4"
                  fill={isHovered ? "#0747A6" : "#0052CC"}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{ cursor: "pointer" }}
                />
                {s.points > 0 && (
                  <text x={barX + barWidth / 2} y={barTop - 6} textAnchor="middle" className="fill-jira-navy font-semibold" fontSize="11">
                    {s.points}
                  </text>
                )}
                <text
                  x={barX + barWidth / 2}
                  y={HEIGHT - MARGIN.bottom + 16}
                  textAnchor="middle"
                  className="fill-jira-gray-500"
                  fontSize="10"
                >
                  {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                </text>
              </g>
            );
          })}
        </svg>

        {hoverIndex !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-jira-navy text-white text-[11px] rounded-md px-2.5 py-1.5 shadow-lg z-10 whitespace-nowrap"
            style={{
              left: `${((MARGIN.left + (hoverIndex + 0.5) * slotWidth) / WIDTH) * 100}%`,
              transform: hoverIndex > sprints.length * 0.7 ? "translateX(-100%)" : "translateX(-8px)",
            }}
          >
            <div className="font-semibold mb-0.5">{sprints[hoverIndex].name}</div>
            <div>{sprints[hoverIndex].points} points completed</div>
            <div className="text-jira-gray-300">{sprints[hoverIndex].issueCount} issues</div>
          </div>
        )}
      </div>
    </div>
  );
}
