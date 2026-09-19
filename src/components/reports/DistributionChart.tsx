"use client";

import React, { useState, useMemo } from "react";
import { PieChart, CheckCircle2, User as UserIcon, Tag, AlertCircle } from "lucide-react";
import type {
  ProjectDistributionReport,
  DistributionEntry,
  AssigneeDistributionEntry,
} from "@/lib/actions/reports";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import UserAvatar from "@/components/common/UserAvatar";

interface DistributionChartProps {
  data: ProjectDistributionReport | null;
  isLoading?: boolean;
}

type Dimension = "status" | "priority" | "type" | "assignee";

export default function DistributionChart({ data, isLoading = false }: DistributionChartProps) {
  const [dimension, setDimension] = useState<Dimension>("status");
  const [metricUnit, setMetricUnit] = useState<"issues" | "points">("issues");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isIssueUnit = metricUnit === "issues";

  const rawItems = useMemo(() => {
    if (!data) return [];
    if (dimension === "status") return data.byStatus;
    if (dimension === "priority") return data.byPriority;
    if (dimension === "type") return data.byType;
    if (dimension === "assignee") {
      return data.byAssignee.map((a) => ({
        name: a.name,
        color: a.id === "unassigned" ? "#8993A4" : "#0052CC",
        count: a.count,
        points: a.points,
        avatarUrl: a.avatarUrl,
        completedCount: a.completedCount,
        completedPoints: a.completedPoints,
      }));
    }
    return [];
  }, [data, dimension]);

  const activeItems = useMemo(() => {
    return rawItems.filter((i) => (isIssueUnit ? i.count > 0 : i.points > 0));
  }, [rawItems, isIssueUnit]);

  const totalValue = useMemo(() => {
    return activeItems.reduce(
      (sum, item) => sum + (isIssueUnit ? item.count : item.points),
      0
    );
  }, [activeItems, isIssueUnit]);

  // Donut SVG geometry calculation
  const donutSegments = useMemo(() => {
    if (totalValue === 0 || activeItems.length === 0) return [];

    let currentAngle = -90; // Start at top
    const radius = 80;
    const strokeWidth = 28;
    const cx = 100;
    const cy = 100;

    return activeItems.map((item, idx) => {
      const val = isIssueUnit ? item.count : item.points;
      const percentage = (val / totalValue) * 100;
      const angleSpan = (val / totalValue) * 360;

      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle += angleSpan;

      // Arc path coordinates for SVG stroke-dasharray
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = -((startAngle + 90) / 360) * circumference;
      const strokeDasharray = `${(angleSpan / 360) * circumference} ${circumference}`;

      return {
        ...item,
        value: val,
        percentage: Math.round(percentage),
        exactPercentage: percentage,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [activeItems, totalValue, isIssueUnit]);

  const unitLabel = isIssueUnit ? "issues" : "pts";

  if (!data || totalValue === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <PieChart className="w-8 h-8" />
        <p className="text-xs">No issues found to display distribution.</p>
      </div>
    );
  }

  const focusedItem = hoveredIndex !== null ? donutSegments[hoveredIndex] : null;

  return (
    <div className="space-y-4">
      {/* Top Controls: Dimension tabs & Unit selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jira-gray-200 pb-3">
        {/* Dimension Tabs */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          {[
            { id: "status", label: "By Status" },
            { id: "priority", label: "By Priority" },
            { id: "type", label: "By Type" },
            { id: "assignee", label: "By Assignee" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setDimension(tab.id as Dimension);
                setHoveredIndex(null);
              }}
              className={`px-3 py-1 rounded font-medium transition-all ${
                dimension === tab.id
                  ? "bg-white text-jira-navy shadow-2xs font-semibold"
                  : "text-jira-gray-600 hover:text-jira-navy"
              }`}
            >
              {tab.label}
            </button>
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

      {/* Main Visual: Donut Chart + Segmented Bars + Breakdown List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Donut Chart */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-52 h-52">
            <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
              {/* Background Ring */}
              <circle cx="100" cy="100" r="80" fill="none" stroke="#F4F5F7" strokeWidth="28" />

              {/* Slices */}
              {donutSegments.map((seg, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <circle
                    key={seg.name}
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isHovered ? 34 : 28}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-all duration-150 cursor-pointer"
                    opacity={hoveredIndex !== null && !isHovered ? 0.4 : 1}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>

            {/* Donut Center Counter / Highlight */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              {focusedItem ? (
                <>
                  <div className="text-xl font-extrabold text-jira-navy leading-none">
                    {focusedItem.percentage}%
                  </div>
                  <div className="text-[11px] font-semibold text-jira-gray-700 truncate max-w-[120px] mt-1">
                    {prettifyStatusName(focusedItem.name)}
                  </div>
                  <div className="text-[10px] text-jira-gray-500">
                    {focusedItem.value} {unitLabel}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-extrabold text-jira-navy leading-none">
                    {totalValue}
                  </div>
                  <div className="text-[11px] font-semibold uppercase text-jira-gray-500 tracking-wider mt-1">
                    Total {unitLabel}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Data Table & Progress Rows */}
        <div className="lg:col-span-7 space-y-3">
          {/* Segmented Horizontal Progress Bar */}
          <div className="h-3 rounded-full overflow-hidden bg-jira-gray-200 flex gap-0.5">
            {donutSegments.map((seg, idx) => (
              <div
                key={seg.name}
                style={{ width: `${seg.exactPercentage}%`, backgroundColor: seg.color }}
                className={`h-full transition-opacity cursor-pointer ${
                  hoveredIndex !== null && hoveredIndex !== idx ? "opacity-30" : "opacity-100"
                }`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                title={`${prettifyStatusName(seg.name)}: ${seg.value} ${unitLabel} (${seg.percentage}%)`}
              />
            ))}
          </div>

          {/* Breakdown Items List */}
          <div className="divide-y divide-jira-gray-100 max-h-56 overflow-y-auto pr-1">
            {donutSegments.map((seg, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <div
                  key={seg.name}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`py-2 px-2.5 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isHovered ? "bg-jira-gray-100 font-semibold" : "hover:bg-jira-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-jira-navy truncate font-medium">
                      {prettifyStatusName(seg.name)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
                    <span className="text-jira-gray-600">
                      {seg.value} {unitLabel}
                    </span>
                    <span className="text-jira-gray-400 w-10 text-right">
                      {seg.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
