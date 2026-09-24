"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calendar, Layers } from "lucide-react";
import type { EpicProgressItem } from "@/lib/actions/reports";
import { formatCalendarDate, isCalendarDateBeforeToday } from "@/lib/calendarDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { issueHref } from "@/lib/issueUrls";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import { DataTable, EmptyChart, Headline, Legend, ReportCard, Segmented } from "./kit";
import { Tooltip } from "@/components/ui/Popover";

type Filter = "all" | "open" | "done";

/**
 * Each epic's child issues as one bar split by status, in workflow colours.
 * It leads with how much of all epic work is done.
 */
export default function EpicProgressChart({ epics, projectKey }: { epics: EpicProgressItem[]; projectKey: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = epics.filter((e) => (filter === "done" ? e.completionPct === 100 : filter === "open" ? e.completionPct < 100 : true));
  const legend = Array.from(new Map(epics.flatMap((e) => e.segments).map((s) => [s.name, s.color])).entries());

  const totalPoints = epics.reduce((a, e) => a + e.totalPoints, 0);
  const donePoints = epics.reduce((a, e) => a + e.completedPoints, 0);
  const totalIssues = epics.reduce((a, e) => a + e.totalIssues, 0);
  const doneIssues = epics.reduce((a, e) => a + e.completedIssues, 0);
  // By points when epics are estimated, otherwise by issue count, as each epic's own percentage is.
  const overall =
    totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
  const finished = epics.filter((e) => e.completionPct === 100).length;

  const chart =
    epics.length === 0 ? (
      <EmptyChart icon={<Layers aria-hidden="true" />}>This project has no epics yet.</EmptyChart>
    ) : shown.length === 0 ? (
      <p className="py-8 text-center text-xs text-muted">No epics match.</p>
    ) : (
      <ul className="divide-y divide-subtle">
        {shown.map((epic) => {
          const late = isCalendarDateBeforeToday(epic.dueDate) && epic.completionPct < 100;
          const by = epic.totalPoints > 0 ? "points" : "issues";
          return (
            <li key={epic.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <IssueTypeIcon type="EPIC" className="h-4 w-4 shrink-0" />
                  <span className="shrink-0 font-mono text-xs text-ink-2">{epic.key}</span>
                  <Link
                    prefetch={false}
                    href={issueHref(projectKey, epic.key)}
                    className="truncate text-[13px] font-medium text-ink hover:text-accent hover:underline"
                  >
                    {epic.title}
                  </Link>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  {epic.dueDate && (
                    <span className={late ? "flex items-center gap-1 font-medium text-danger" : "flex items-center gap-1 text-muted"}>
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      {late && "Overdue, "}
                      {formatCalendarDate(epic.dueDate, "MMM d, yyyy")}
                    </span>
                  )}
                  <span className="font-semibold tabular-nums text-ink">{epic.completionPct}%</span>
                </div>
              </div>
              <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-[3px] bg-surface-sunk">
                {epic.segments.map((seg) => {
                  const share =
                    epic.totalPoints > 0 ? seg.points / epic.totalPoints : epic.totalIssues > 0 ? seg.issues / epic.totalIssues : 0;
                  if (share <= 0) return null;
                  return (
                    <Tooltip key={seg.name} content={`${prettifyStatusName(seg.name)}: ${seg.points} pts, ${seg.issues} issues`}>
                      <span
                        className="h-full"
                        style={{ width: `${share * 100}%`, backgroundColor: seg.color }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
              <p className="text-xs text-muted">
                {by === "points"
                  ? `${epic.completedPoints} of ${epic.totalPoints} pts`
                  : `${epic.completedIssues} of ${epic.totalIssues} issues`}{" "}
                done
                {epic.segments.length > 0 && (
                  <span className="sr-only">
                    {": "}
                    {epic.segments
                      .map((s) => `${prettifyStatusName(s.name)} ${by === "points" ? `${s.points} pts` : `${s.issues} issues`}`)
                      .join(", ")}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    );

  return (
    <ReportCard
      title="Epic progress"
      description="Each epic's child issues by status."
      headline={
        epics.length > 0 ? (
          <Headline
            label="Epic work done"
            value={`${overall}%`}
            detail={totalPoints > 0 ? `${donePoints} of ${totalPoints} story points` : `${doneIssues} of ${totalIssues} issues`}
            figures={[{ label: "Epics finished", value: `${finished} of ${epics.length}` }]}
          />
        ) : undefined
      }
      legend={<Legend items={legend.map(([name, color]) => ({ label: prettifyStatusName(name), color }))} />}
      controls={
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All (${epics.length})` },
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
          ]}
        />
      }
      chart={chart}
      table={
        <DataTable
          caption="Epic progress"
          columns={[
            { label: "Epic" },
            { label: "Done", numeric: true },
            { label: "Points done", numeric: true },
            { label: "Issues done", numeric: true },
            { label: "Due" },
          ]}
          rows={shown.map((e) => ({
            key: e.id,
            cells: [
              `${e.key} ${e.title}`,
              `${e.completionPct}%`,
              `${e.completedPoints} / ${e.totalPoints}`,
              `${e.completedIssues} / ${e.totalIssues}`,
              e.dueDate ? formatCalendarDate(e.dueDate, "MMM d, yyyy") : "–",
            ],
          }))}
        />
      }
    />
  );
}
