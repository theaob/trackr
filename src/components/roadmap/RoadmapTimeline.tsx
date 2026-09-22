"use client";

import React, { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  format,
  startOfMonth,
} from "date-fns";
import { Map as MapIcon, ChevronDown, ChevronRight } from "lucide-react";
import { IssueTypeIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { IssueType, User } from "@/types";
import { calendarDateToLocal } from "@/lib/calendarDate";

export interface RoadmapChildIssue {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  status: string;
  statusColor?: string;
  priority: string;
  storyPoints: number | null;
  startDate: string | Date | null;
  dueDate: string | Date | null;
  parentId: string | null;
  isDone?: boolean;
  assignee?: User | null;
}

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
  children?: RoadmapChildIssue[];
}

interface RoadmapTimelineProps {
  epics: RoadmapEpic[];
  onSelectIssue?: (issueKeyOrId: string) => void;
}

const ROW_HEIGHT = 42;
const CHILD_ROW_HEIGHT = 34;
const LABEL_WIDTH_PCT = 28;

function progressPct(epic: RoadmapEpic): number {
  if (epic.totalPoints > 0) return Math.round((epic.completedPoints / epic.totalPoints) * 100);
  if (epic.totalCount > 0) return Math.round((epic.completedCount / epic.totalCount) * 100);
  return epic.isDone ? 100 : 0;
}

export default function RoadmapTimeline({ epics, onSelectIssue }: RoadmapTimelineProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});

  const toggleEpicExpand = (epicId: string) => {
    setExpandedEpics((prev) => ({ ...prev, [epicId]: !prev[epicId] }));
  };

  const scheduled = epics.filter((e) => e.startDate && e.dueDate);
  const unscheduled = epics.filter((e) => !e.startDate || !e.dueDate);

  const { rangeStart, rangeEnd, months } = useMemo(() => {
    if (scheduled.length === 0) {
      const today = new Date();
      return { rangeStart: today, rangeEnd: addDays(today, 30), months: [] as Date[] };
    }
    const starts = scheduled.map((e) => calendarDateToLocal(e.startDate)!.getTime());
    const ends = scheduled.map((e) => calendarDateToLocal(e.dueDate)!.getTime());
    const minStart = addDays(new Date(Math.min(...starts)), -3);
    const maxEnd = addDays(new Date(Math.max(...ends)), 3);
    const monthList = eachMonthOfInterval({ start: startOfMonth(minStart), end: maxEnd });
    return { rangeStart: minStart, rangeEnd: maxEnd, months: monthList };
  }, [scheduled]);

  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const pctFor = (date: Date) => (differenceInCalendarDays(date, rangeStart) / totalDays) * 100;

  // Skip a month label that would sit too close to the previous one
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
        <div className="border border-jira-gray-200 rounded-md overflow-hidden bg-white shadow-xs">
          {/* Month header */}
          <div className="flex text-[11px] font-semibold text-jira-gray-600 bg-jira-gray-50 border-b border-jira-gray-200">
            <div style={{ width: `${LABEL_WIDTH_PCT}%` }} className="shrink-0 px-3 py-2">
              Epic / Child Issues
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
            <div
              className="absolute inset-y-0 pointer-events-none"
              style={{ left: `${LABEL_WIDTH_PCT}%`, right: 0 }}
            >
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
              const start = calendarDateToLocal(epic.startDate)!;
              const end = calendarDateToLocal(epic.dueDate)!;
              const left = Math.max(0, pctFor(start));
              const width = Math.max(1.2, pctFor(end) - pctFor(start));
              const progress = progressPct(epic);
              const isHovered = hoverId === epic.id;
              const hasChildren = epic.children && epic.children.length > 0;
              const isExpanded = !!expandedEpics[epic.id];

              return (
                <React.Fragment key={epic.id}>
                  {/* Epic Row */}
                  <div
                    className="flex items-center border-b border-jira-gray-100 last:border-b-0 hover:bg-jira-gray-50/70 transition-colors group"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Left label column */}
                    <div
                      style={{ width: `${LABEL_WIDTH_PCT}%` }}
                      className="shrink-0 px-2 flex items-center gap-1.5 min-w-0"
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEpicExpand(epic.id);
                          }}
                          className="p-1 text-jira-gray-400 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors"
                          title={isExpanded ? "Collapse issues" : "Expand issues in this epic"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <div className="w-5 shrink-0" />
                      )}

                      <IssueTypeIcon type="EPIC" className="w-3.5 h-3.5 shrink-0" />

                      <button
                        type="button"
                        onClick={() => onSelectIssue?.(epic.key)}
                        className="text-[11px] font-bold text-jira-blue hover:underline shrink-0"
                        title="Click to view epic details"
                      >
                        {epic.key}
                      </button>

                      <span
                        onClick={() => onSelectIssue?.(epic.key)}
                        className="text-xs font-semibold text-jira-navy truncate cursor-pointer hover:text-jira-blue transition-colors"
                        title={epic.title}
                      >
                        {epic.title}
                      </span>

                      {hasChildren && (
                        <span className="text-[10px] bg-jira-gray-100 text-jira-gray-600 px-1.5 py-0.2 rounded-full font-semibold shrink-0 ml-auto mr-1">
                          {epic.children!.length}
                        </span>
                      )}
                    </div>

                    {/* Timeline bar area */}
                    <div className="relative flex-1 h-full">
                      <div
                        role="img"
                        aria-label={`${epic.key}: ${format(start, "MMM d")} to ${format(
                          end,
                          "MMM d, yyyy"
                        )}, ${progress}% complete`}
                        onMouseEnter={() => setHoverId(epic.id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={() => onSelectIssue?.(epic.key)}
                        className="absolute rounded-full overflow-hidden cursor-pointer transition-all shadow-xs"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 10,
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
                          className="absolute -top-2 -translate-y-full bg-jira-navy text-white text-[11px] rounded-md px-2.5 py-1.5 shadow-lg z-30 whitespace-nowrap pointer-events-none"
                          style={{ left: `${Math.min(left, 60)}%` }}
                        >
                          <div className="font-semibold mb-0.5">
                            {epic.key}: {epic.title}
                          </div>
                          <div>
                            {format(start, "MMM d, yyyy")} &ndash; {format(end, "MMM d, yyyy")}
                          </div>
                          <div>
                            {progress}% complete &middot; {epic.completedCount}/{epic.totalCount}{" "}
                            issues
                          </div>
                          <div className="text-[10px] text-jira-gray-300 mt-0.5">
                            Click to view details & linked issues
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Child Issues */}
                  {isExpanded &&
                    hasChildren &&
                    epic.children!.map((child) => {
                      const childHasDates = child.startDate && child.dueDate;
                      const childStart = childHasDates ? calendarDateToLocal(child.startDate) : null;
                      const childEnd = childHasDates ? calendarDateToLocal(child.dueDate) : null;
                      const childLeft = childStart ? Math.max(0, pctFor(childStart)) : left;
                      const childWidth =
                        childStart && childEnd
                          ? Math.max(1.2, pctFor(childEnd) - pctFor(childStart))
                          : width;
                      const isChildHovered = hoverId === child.id;

                      return (
                        <div
                          key={child.id}
                          className="flex items-center border-b border-jira-gray-100 bg-jira-gray-50/30 hover:bg-jira-gray-100/50 transition-colors"
                          style={{ height: CHILD_ROW_HEIGHT }}
                        >
                          {/* Indented child label */}
                          <div
                            style={{ width: `${LABEL_WIDTH_PCT}%` }}
                            className="shrink-0 pl-7 pr-2 flex items-center gap-1.5 min-w-0"
                          >
                            <IssueTypeIcon type={child.type} className="w-3 h-3 shrink-0" />

                            <button
                              type="button"
                              onClick={() => onSelectIssue?.(child.key)}
                              className={`text-[11px] font-bold text-jira-blue hover:underline shrink-0 ${
                                child.isDone ? "line-through text-jira-gray-400" : ""
                              }`}
                            >
                              {child.key}
                            </button>

                            <span
                              onClick={() => onSelectIssue?.(child.key)}
                              className={`text-xs text-jira-gray-700 truncate cursor-pointer hover:text-jira-blue transition-colors ${
                                child.isDone ? "line-through text-jira-gray-400" : ""
                              }`}
                              title={child.title}
                            >
                              {child.title}
                            </span>

                            <div className="ml-auto shrink-0 flex items-center gap-1.5">
                              {child.storyPoints !== null && (
                                <span className="text-[10px] font-bold bg-jira-gray-200 text-jira-gray-600 px-1 rounded">
                                  {child.storyPoints}
                                </span>
                              )}
                              <UserAvatar user={child.assignee} size="sm" />
                            </div>
                          </div>

                          {/* Child Timeline Representation */}
                          <div className="relative flex-1 h-full">
                            {childHasDates ? (
                              <>
                                <div
                                  onMouseEnter={() => setHoverId(child.id)}
                                  onMouseLeave={() => setHoverId(null)}
                                  onClick={() => onSelectIssue?.(child.key)}
                                  className="absolute rounded-full cursor-pointer transition-all shadow-xs"
                                  style={{
                                    left: `${childLeft}%`,
                                    width: `${childWidth}%`,
                                    top: 10,
                                    height: 14,
                                    backgroundColor: child.statusColor || "#6B7280",
                                    opacity: isChildHovered ? 1 : 0.85,
                                    outline: isChildHovered ? "2px solid #0052CC" : "none",
                                    outlineOffset: 1,
                                  }}
                                />

                                {isChildHovered && (
                                  <div
                                    className="absolute -top-2 -translate-y-full bg-jira-navy text-white text-[11px] rounded-md px-2 py-1 shadow-lg z-30 whitespace-nowrap pointer-events-none"
                                    style={{ left: `${Math.min(childLeft, 60)}%` }}
                                  >
                                    <div className="font-semibold">{child.key}: {child.title}</div>
                                    <div>
                                      {format(childStart!, "MMM d")} &ndash; {format(childEnd!, "MMM d, yyyy")}
                                    </div>
                                    <div className="text-[10px] text-jira-gray-300">
                                      Status: {child.status}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              /* For issues without individual dates, show subtle span under epic */
                              <div
                                onClick={() => onSelectIssue?.(child.key)}
                                className="absolute rounded-full cursor-pointer transition-all"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  top: 14,
                                  height: 6,
                                  backgroundColor: child.statusColor ? `${child.statusColor}55` : "#CBD5E1",
                                }}
                                title={`${child.key}: ${child.title} (inherits epic timeline)`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-jira-gray-500 italic py-4">
          None of your epics have both a start and due date set yet.
        </div>
      )}

      {/* Unscheduled Epics List */}
      {unscheduled.length > 0 && (
        <div className="mt-5 bg-white border border-jira-gray-200 rounded-md p-4">
          <h3 className="text-[11px] font-bold text-jira-gray-600 uppercase tracking-wide mb-1">
            Not scheduled ({unscheduled.length})
          </h3>
          <p className="text-[11px] text-jira-gray-500 mb-3">
            Click an epic to view all its linked issues or set dates to plot it on the timeline.
          </p>

          <div className="space-y-1.5">
            {unscheduled.map((epic) => {
              const hasChildren = epic.children && epic.children.length > 0;
              const isExpanded = !!expandedEpics[epic.id];

              return (
                <div key={epic.id} className="border border-jira-gray-100 rounded-md overflow-hidden">
                  <div
                    onClick={() => onSelectIssue?.(epic.key)}
                    className="flex items-center justify-between p-2 hover:bg-jira-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEpicExpand(epic.id);
                          }}
                          className="p-0.5 text-jira-gray-400 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4.5 shrink-0" />
                      )}

                      <IssueTypeIcon type="EPIC" className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold text-jira-blue hover:underline text-xs shrink-0">
                        {epic.key}
                      </span>
                      <span className="text-xs text-jira-navy font-medium truncate group-hover:text-jira-blue">
                        {epic.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={epic.status} />
                      <span className="text-[11px] text-jira-gray-500">
                        {epic.completedCount}/{epic.totalCount} issues
                      </span>
                    </div>
                  </div>

                  {/* Expanded child issues of unscheduled epic */}
                  {isExpanded && hasChildren && (
                    <div className="bg-jira-gray-50/60 border-t border-jira-gray-100 divide-y divide-jira-gray-100 pl-6 pr-2 py-1">
                      {epic.children!.map((child) => (
                        <div
                          key={child.id}
                          onClick={() => onSelectIssue?.(child.key)}
                          className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <IssueTypeIcon type={child.type} className="w-3 h-3 shrink-0" />
                            <span className="font-bold text-jira-blue hover:underline shrink-0">
                              {child.key}
                            </span>
                            <span className="truncate text-jira-navy font-medium">
                              {child.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={child.status} />
                            <UserAvatar user={child.assignee} size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
