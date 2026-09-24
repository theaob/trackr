"use client";

import React, { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, eachMonthOfInterval, format, startOfMonth } from "date-fns";
import { ChevronDown, ChevronRight, Map as MapIcon } from "lucide-react";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { cn } from "@/components/ui/cn";
import { IssueType, User } from "@/types";
import { calendarDateToLocal } from "@/lib/calendarDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { EmptyChart, HoverCard, Legend, series } from "@/components/reports/kit";

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

const LABEL = "w-72 shrink-0";

export function progressPct(epic: RoadmapEpic): number {
  if (epic.totalPoints > 0) return Math.round((epic.completedPoints / epic.totalPoints) * 100);
  if (epic.totalCount > 0) return Math.round((epic.completedCount / epic.totalCount) * 100);
  return epic.isDone ? 100 : 0;
}

/** The first and last day to draw, a few days either side of the scheduled epics. */
export function timelineRange(epics: RoadmapEpic[], today = new Date()) {
  const scheduled = epics.filter((e) => e.startDate && e.dueDate);
  if (scheduled.length === 0) return { start: today, end: addDays(today, 30) };
  const starts = scheduled.map((e) => calendarDateToLocal(e.startDate)!.getTime());
  const ends = scheduled.map((e) => calendarDateToLocal(e.dueDate)!.getTime());
  return { start: addDays(new Date(Math.min(...starts)), -3), end: addDays(new Date(Math.max(...ends)), 3) };
}

/**
 * Epics on a timeline, with the reports' bars, today line and hover card.
 * Each bar fills with the epic's progress; expanding an epic shows its child
 * issues, with their own dates where they have them.
 */
export default function RoadmapTimeline({ epics, onSelectIssue }: RoadmapTimelineProps) {
  const [hover, setHoverState] = useState<{ id: string; x: number; y: number } | null>(null);
  // The card sits under the bar, placed on screen so the scrolling timeline can't clip it.
  const hoverOn = (id: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverState({ id, x: r.left, y: r.bottom + 6 });
  };
  const hoverOff = () => setHoverState(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const scheduled = epics.filter((e) => e.startDate && e.dueDate);
  const unscheduled = epics.filter((e) => !e.startDate || !e.dueDate);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => timelineRange(epics), [epics]);
  const months = useMemo(
    () => (scheduled.length ? eachMonthOfInterval({ start: startOfMonth(rangeStart), end: rangeEnd }) : []),
    [scheduled.length, rangeStart, rangeEnd]
  );
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const pctFor = (d: Date) => (differenceInCalendarDays(d, rangeStart) / totalDays) * 100;

  // Skip a month label that would crowd the one before it.
  const labelled = useMemo(() => {
    let last = -Infinity;
    const shown = new Set<string>();
    for (const m of months) {
      const pct = Math.max(0, (differenceInCalendarDays(m, rangeStart) / totalDays) * 100);
      if (pct - last >= 9) {
        shown.add(m.toISOString());
        last = pct;
      }
    }
    return shown;
  }, [months, rangeStart, totalDays]);

  const today = new Date();
  const todayPct = pctFor(today);
  const showToday = todayPct >= 0 && todayPct <= 100;
  const done = series(1);
  const track = series("1-soft");

  if (epics.length === 0) {
    return <EmptyChart icon={<MapIcon aria-hidden="true" />}>This project has no epics yet.</EmptyChart>;
  }

  const expandButton = (epic: RoadmapEpic) =>
    epic.children && epic.children.length > 0 ? (
      <button
        type="button"
        onClick={() => toggle(epic.id)}
        aria-expanded={!!expanded[epic.id]}
        aria-label={`${expanded[epic.id] ? "Hide" : "Show"} the ${epic.children.length} issues in ${epic.key}`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink"
      >
        {expanded[epic.id] ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    ) : (
      <span className="w-6 shrink-0" />
    );

  const issueLink = (key: string, title: string, type: IssueType, muted = false) => (
    <button type="button" onClick={() => onSelectIssue?.(key)} className="flex min-w-0 items-center gap-1.5 text-left hover:underline">
      <IssueTypeIcon type={type} className="h-4 w-4 shrink-0" />
      <span className="shrink-0 font-mono text-xs text-ink-2">{key}</span>
      <span className={cn("truncate text-[13px]", muted ? "text-muted line-through" : "text-ink")}>{title}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {scheduled.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-subtle">
          <div className="min-w-[760px]">
            <div className="flex h-9 border-b border-subtle bg-surface-sunk text-xs font-medium text-ink-2">
              <div className={cn(LABEL, "flex items-center px-3")}>Epic</div>
              <div className="relative flex-1">
                {months.map((m) => (
                  <span key={m.toISOString()} className="absolute top-2.5 pl-1.5" style={{ left: `${Math.max(0, pctFor(m))}%` }}>
                    {labelled.has(m.toISOString()) ? format(m, "MMM yyyy") : ""}
                  </span>
                ))}
                {showToday && (
                  <span
                    className="absolute top-1.5 z-10 -translate-x-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-fg"
                    style={{ left: `${todayPct}%` }}
                  >
                    Today
                  </span>
                )}
              </div>
            </div>

            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-72">
                {months.map((m) => (
                  <span
                    key={m.toISOString()}
                    className="absolute inset-y-0 border-l border-subtle"
                    style={{ left: `${Math.max(0, pctFor(m))}%` }}
                  />
                ))}
                {showToday && <span className="absolute inset-y-0 z-10 border-l-2 border-accent" style={{ left: `${todayPct}%` }} />}
              </div>

              {scheduled.map((epic) => {
                const start = calendarDateToLocal(epic.startDate)!;
                const end = calendarDateToLocal(epic.dueDate)!;
                const left = Math.max(0, pctFor(start));
                const width = Math.max(1.2, pctFor(end) - pctFor(start));
                const progress = progressPct(epic);
                return (
                  <React.Fragment key={epic.id}>
                    <div className="flex h-11 items-center border-b border-subtle last:border-b-0 hover:bg-surface-sunk/60">
                      <div className={cn(LABEL, "flex min-w-0 items-center gap-1 px-2")}>
                        {expandButton(epic)}
                        {issueLink(epic.key, epic.title, "EPIC")}
                      </div>
                      <div className="relative h-full flex-1">
                        <button
                          type="button"
                          onClick={() => onSelectIssue?.(epic.key)}
                          onMouseEnter={hoverOn(epic.id)}
                          onMouseLeave={hoverOff}
                          onFocus={hoverOn(epic.id)}
                          onBlur={hoverOff}
                          aria-label={`${epic.key}: ${format(start, "MMM d")} to ${format(end, "MMM d, yyyy")}, ${progress}% done`}
                          className="absolute top-3.5 h-4 overflow-hidden rounded-[4px]"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: track }}
                        >
                          <span className="block h-full" style={{ width: `${progress}%`, backgroundColor: done }} />
                        </button>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-3.5 text-xs leading-4 tabular-nums text-ink-2",
                            left + width > 92 ? "pr-1.5" : "pl-1.5"
                          )}
                          // Beside the bar's end, or before its start when the end is at the edge.
                          style={left + width > 92 ? { right: `${100 - left}%` } : { left: `${left + width}%` }}
                        >
                          {progress}%
                        </span>
                        {hover?.id === epic.id && (
                          <HoverCard
                            at={hover}
                            title={`${epic.key} ${epic.title}`}
                            rows={[
                              { label: "Dates", value: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` },
                              { label: "Done", value: `${progress}%`, color: done },
                              { label: "Issues done", value: `${epic.completedCount} of ${epic.totalCount}` },
                            ]}
                            footer={{ label: "Status", value: prettifyStatusName(epic.status) }}
                          />
                        )}
                      </div>
                    </div>

                    {expanded[epic.id] &&
                      epic.children?.map((child) => {
                        const cs = child.startDate && child.dueDate ? calendarDateToLocal(child.startDate) : null;
                        const ce = child.startDate && child.dueDate ? calendarDateToLocal(child.dueDate) : null;
                        const cl = cs ? Math.max(0, pctFor(cs)) : left;
                        const cw = cs && ce ? Math.max(1.2, pctFor(ce) - pctFor(cs)) : width;
                        return (
                          <div key={child.id} className="flex h-9 items-center border-b border-subtle bg-page hover:bg-surface-sunk/60">
                            <div className={cn(LABEL, "flex min-w-0 items-center gap-2 pl-9 pr-2")}>
                              {issueLink(child.key, child.title, child.type, child.isDone)}
                              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                {child.storyPoints !== null && (
                                  <span className="font-mono text-[11px] text-ink-2">{child.storyPoints}</span>
                                )}
                                <UserAvatar user={child.assignee} size="xs" />
                              </span>
                            </div>
                            <div className="relative h-full flex-1">
                              {cs && ce ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectIssue?.(child.key)}
                                  onMouseEnter={hoverOn(child.id)}
                                  onMouseLeave={hoverOff}
                                  onFocus={hoverOn(child.id)}
                                  onBlur={hoverOff}
                                  aria-label={`${child.key}: ${format(cs, "MMM d")} to ${format(ce, "MMM d, yyyy")}, ${prettifyStatusName(child.status)}`}
                                  className="absolute top-3 h-3 rounded-[4px]"
                                  style={{ left: `${cl}%`, width: `${cw}%`, backgroundColor: child.isDone ? done : track }}
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-4 h-1 rounded-full border-t border-dashed border-strong"
                                  style={{ left: `${cl}%`, width: `${cw}%` }}
                                  title={`${child.key} has no dates of its own`}
                                />
                              )}
                              {hover?.id === child.id && cs && ce && (
                                <HoverCard
                                  at={hover}
                                  title={`${child.key} ${child.title}`}
                                  rows={[{ label: "Dates", value: `${format(cs, "MMM d")} – ${format(ce, "MMM d, yyyy")}` }]}
                                  footer={{ label: "Status", value: prettifyStatusName(child.status) }}
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
        </div>
      ) : (
        <p className="text-xs text-muted">No epic has both a start and a due date yet.</p>
      )}

      {scheduled.length > 0 && (
        <Legend
          items={[
            { label: "Done", color: done },
            { label: "Still to do", color: track },
            { label: "Today", color: "rgb(var(--color-accent))", kind: "line" },
          ]}
        />
      )}

      {unscheduled.length > 0 && (
        <section aria-labelledby="roadmap-unscheduled">
          <h2 id="roadmap-unscheduled" className="text-sm font-semibold text-ink">
            Not scheduled <span className="font-normal text-muted">{unscheduled.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">Give an epic a start and a due date to put it on the timeline.</p>
          <ul className="mt-3 divide-y divide-subtle rounded-card border border-subtle">
            {unscheduled.map((epic) => (
              <li key={epic.id}>
                <div className="flex h-10 items-center gap-1 px-2 hover:bg-surface-sunk/60">
                  {expandButton(epic)}
                  {issueLink(epic.key, epic.title, "EPIC")}
                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <StatusLozenge label={prettifyStatusName(epic.status)} color={epic.statusColor} />
                    <span className="text-xs tabular-nums text-muted">
                      {epic.completedCount} of {epic.totalCount} done
                    </span>
                  </span>
                </div>
                {expanded[epic.id] && epic.children && (
                  <ul className="divide-y divide-subtle border-t border-subtle bg-page">
                    {epic.children.map((child) => (
                      <li key={child.id} className="flex h-9 items-center gap-2 pl-9 pr-2">
                        {issueLink(child.key, child.title, child.type, child.isDone)}
                        <span className="ml-auto flex shrink-0 items-center gap-2">
                          <StatusLozenge label={prettifyStatusName(child.status)} color={child.statusColor} />
                          <UserAvatar user={child.assignee} size="xs" />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
