"use client";

import React, { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, eachMonthOfInterval, format, startOfMonth } from "date-fns";
import { Map as MapIcon } from "lucide-react";
import { IssueTypeIcon } from "@/components/common/IssueIcons";

export interface RoadmapEpic {
  id: string;
  key: string;
  title: string;
  status: string;
  statusColor: string;
  isDone: boolean;
  startDate: string | Date | null;
  dueDate: string | Date | null;
  totalCount: number;
  completedCount: number;
  totalPoints: number;
  completedPoints: number;
}

interface RoadmapTimelineProps {
  epics: RoadmapEpic[];
}

const ROW_HEIGHT = 40;
const LABEL_WIDTH_PCT = 26;

function progressPct(epic: RoadmapEpic): number {
  if (epic.totalPoints > 0) return Math.round((epic.completedPoints / epic.totalPoints) * 100);
  if (epic.totalCount > 0) return Math.round((epic.completedCount / epic.totalCount) * 100);
  return epic.isDone ? 100 : 0;
}

export default function RoadmapTimeline({ epics }: RoadmapTimelineProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const scheduled = epics.filter((e) => e.startDate && e.dueDate);
  const unscheduled = epics.filter((e) => !e.startDate || !e.dueDate);

  const { rangeStart, rangeEnd, months } = useMemo(() => {
    if (scheduled.length === 0) {
      const today = new Date();
      return { rangeStart: today, rangeEnd: addDays(today, 30), months: [] as Date[] };
    }
    const starts = scheduled.map((e) => new Date(e.startDate!).getTime());
    const ends = scheduled.map((e) => new Date(e.dueDate!).getTime());
    const minStart = addDays(new Date(Math.min(...starts)), -3);
    const maxEnd = addDays(new Date(Math.max(...ends)), 3);
    const monthList = eachMonthOfInterval({ start: startOfMonth(minStart), end: maxEnd });
    return { rangeStart: minStart, rangeEnd: maxEnd, months: monthList };
  }, [scheduled]);

  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const pctFor = (date: Date) => (differenceInCalendarDays(date, rangeStart) / totalDays) * 100;

  // Skip a month label that would sit too close to the previous one instead
  // of letting adjacent labels overlap (the gridline itself still renders).
  const MIN_LABEL_GAP_PCT = 9;
  const labeledMonths = useMemo(() => {
    let lastShownPct = -Infinity;
    const shown = new Set<string>();
    for (const m of months) {
      const pct = Math.max(0, pctFor(m));
      if (pct - lastShownPct >= MIN_LABEL_GAP_PCT) {
        shown.add(m.toISOString());
        lastShownPct = pct;
      }
    }
    return shown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, rangeStart, rangeEnd]);

  const today = new Date();
  const todayPct = pctFor(today);
  const showTodayLine = todayPct >= 0 && todayPct <= 100;

  if (epics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <MapIcon className="w-8 h-8" />
        <p className="text-xs">No epics in this project yet.</p>
      </div>
    );
  }

  return (
    <div>
      {scheduled.length > 0 ? (
        <div className="border border-jira-gray-200 rounded-md overflow-hidden">
          {/* Month header */}
          <div className="flex text-[11px] font-semibold text-jira-gray-600 bg-jira-gray-50 border-b border-jira-gray-200">
            <div style={{ width: `${LABEL_WIDTH_PCT}%` }} className="shrink-0 px-3 py-2">
              Epic
            </div>
            <div className="relative flex-1 py-2" style={{ minHeight: 28 }}>
              {months.map((m) => (
                <span
                  key={m.toISOString()}
                  className="absolute top-2 border-l border-jira-gray-300 pl-1.5"
                  style={{ left: `${Math.max(0, pctFor(m))}%` }}
                >
                  {labeledMonths.has(m.toISOString()) ? format(m, "MMM yyyy") : ""}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Month gridlines spanning all rows */}
            <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${LABEL_WIDTH_PCT}%`, right: 0 }}>
              {months.map((m) => (
                <div
                  key={m.toISOString()}
                  className="absolute inset-y-0 border-l border-jira-gray-100"
                  style={{ left: `${Math.max(0, pctFor(m))}%` }}
                />
              ))}
              {showTodayLine && (
                <div
                  className="absolute inset-y-0 border-l-2 border-rose-400 z-10"
                  style={{ left: `${todayPct}%` }}
                  title={`Today, ${format(today, "MMM d, yyyy")}`}
                />
              )}
            </div>

            {scheduled.map((epic) => {
              const start = new Date(epic.startDate!);
              const end = new Date(epic.dueDate!);
              const left = Math.max(0, pctFor(start));
              const width = Math.max(1.2, pctFor(end) - pctFor(start));
              const progress = progressPct(epic);
              const isHovered = hoverId === epic.id;

              return (
                <div
                  key={epic.id}
                  className="flex items-center border-b border-jira-gray-100 last:border-b-0 hover:bg-jira-gray-50/60"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div style={{ width: `${LABEL_WIDTH_PCT}%` }} className="shrink-0 px-3 flex items-center gap-1.5 min-w-0">
                    <IssueTypeIcon type="EPIC" className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-bold text-jira-gray-500 shrink-0">{epic.key}</span>
                    <span className="text-xs text-jira-navy truncate">{epic.title}</span>
                  </div>
                  <div className="relative flex-1 h-full">
                    <div
                      role="img"
                      aria-label={`${epic.key}: ${format(start, "MMM d")} to ${format(end, "MMM d, yyyy")}, ${progress}% complete`}
                      onMouseEnter={() => setHoverId(epic.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className="absolute rounded-full overflow-hidden cursor-pointer transition-all"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 9,
                        height: 22,
                        backgroundColor: `${epic.statusColor}33`,
                        outline: isHovered ? `2px solid ${epic.statusColor}` : "none",
                        outlineOffset: 1,
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, backgroundColor: epic.statusColor }}
                      />
                    </div>

                    {isHovered && (
                      <div
                        className="absolute -top-2 -translate-y-full bg-jira-navy text-white text-[11px] rounded-md px-2.5 py-1.5 shadow-lg z-20 whitespace-nowrap pointer-events-none"
                        style={{ left: `${Math.min(left, 60)}%` }}
                      >
                        <div className="font-semibold mb-0.5">
                          {epic.key}: {epic.title}
                        </div>
                        <div>
                          {format(start, "MMM d, yyyy")} &ndash; {format(end, "MMM d, yyyy")}
                        </div>
                        <div>
                          {progress}% complete &middot; {epic.completedCount}/{epic.totalCount} issues
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-jira-gray-500 italic py-4">
          None of your epics have both a start and due date set yet.
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[11px] font-bold text-jira-gray-600 uppercase tracking-wide mb-2">
            Not scheduled ({unscheduled.length})
          </h3>
          <p className="text-[11px] text-jira-gray-500 mb-2">
            Set both a start and due date on these epics to plot them above.
          </p>
          <div className="space-y-1">
            {unscheduled.map((epic) => (
              <div key={epic.id} className="flex items-center gap-1.5 text-xs text-jira-gray-600 px-1">
                <IssueTypeIcon type="EPIC" className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold text-jira-gray-500">{epic.key}</span>
                <span className="truncate">{epic.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
