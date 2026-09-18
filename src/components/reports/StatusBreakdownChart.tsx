"use client";

import React, { useState } from "react";
import { PieChart } from "lucide-react";
import { prettifyStatusName } from "@/lib/workflowDisplay";

export interface StatusBreakdownEntry {
  name: string;
  color: string;
  count: number;
  points: number;
}

interface StatusBreakdownChartProps {
  breakdown: StatusBreakdownEntry[];
}

const GAP = 2;

export default function StatusBreakdownChart({ breakdown }: StatusBreakdownChartProps) {
  const [hoverName, setHoverName] = useState<string | null>(null);

  const usePoints = breakdown.some((b) => b.points > 0);
  const total = breakdown.reduce((sum, b) => sum + (usePoints ? b.points : b.count), 0);

  if (breakdown.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-jira-gray-400 gap-2">
        <PieChart className="w-6 h-6" />
        <p className="text-xs">No issues in this sprint yet.</p>
      </div>
    );
  }

  let cursor = 0;
  const segments = breakdown.map((b) => {
    const value = usePoints ? b.points : b.count;
    const widthPct = (value / total) * 100;
    const segment = { ...b, value, startPct: cursor, widthPct };
    cursor += widthPct;
    return segment;
  });

  return (
    <div>
      <div className="relative h-8 rounded-md overflow-hidden bg-jira-gray-100 flex">
        {segments.map((s) => (
          <div
            key={s.name}
            role="img"
            aria-label={`${prettifyStatusName(s.name)}: ${s.count} issue${s.count === 1 ? "" : "s"}`}
            onMouseEnter={() => setHoverName(s.name)}
            onMouseLeave={() => setHoverName(null)}
            className="h-full transition-opacity cursor-pointer relative"
            style={{
              width: `${s.widthPct}%`,
              backgroundColor: s.color,
              marginLeft: s.startPct === 0 ? 0 : `${GAP}px`,
              opacity: hoverName && hoverName !== s.name ? 0.5 : 1,
            }}
          >
            {hoverName === s.name && (
              <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-jira-navy text-white text-[11px] rounded-md px-2.5 py-1.5 shadow-lg z-10 whitespace-nowrap pointer-events-none">
                <div className="font-semibold">{prettifyStatusName(s.name)}</div>
                <div>
                  {s.count} issue{s.count === 1 ? "" : "s"}
                  {s.points > 0 ? ` · ${s.points} pts` : ""}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[11px] text-jira-gray-700">
        {segments.map((s) => (
          <span
            key={s.name}
            onMouseEnter={() => setHoverName(s.name)}
            onMouseLeave={() => setHoverName(null)}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="font-medium">{prettifyStatusName(s.name)}</span>
            <span className="text-jira-gray-500">({s.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
