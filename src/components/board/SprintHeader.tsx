"use client";

import React from "react";
import { format } from "date-fns";
import type { Sprint } from "@/types";
import { cn } from "@/components/ui/cn";
import { sprintTimeLeft, type SprintProgress } from "@/lib/board";

/**
 * A sprint's progress as one bar split by status category (done, in
 * progress, to do), weighted by story points when the sprint has any.
 */
export function SprintProgressBar({ progress, className }: { progress: SprintProgress; className?: string }) {
  const byPoints = progress.totalPoints > 0;
  const part = byPoints ? progress.points : progress.issues;
  const total = byPoints ? progress.totalPoints : progress.totalIssues;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const unit = byPoints ? "points" : progress.totalIssues === 1 ? "issue" : "issues";
  const summary = `${part.DONE} of ${total} ${unit} done, ${part.IN_PROGRESS} in progress`;

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span aria-hidden="true" className="flex h-1.5 w-28 overflow-hidden rounded-full bg-surface-sunk">
        <span className="h-full bg-success" style={{ width: `${pct(part.DONE)}%` }} />
        <span className="h-full bg-accent" style={{ width: `${pct(part.IN_PROGRESS)}%` }} />
      </span>
      <span aria-hidden="true" className="whitespace-nowrap font-mono text-xs text-ink-2">
        {part.DONE}/{total} {byPoints ? "pts" : ""}
      </span>
      <span className="sr-only">{summary}</span>
    </span>
  );
}

/**
 * The board's heading in one line: the sprint's name, its dates and days
 * left, and its progress, with the goal underneath in muted text.
 */
export default function SprintHeader({
  sprint,
  progress,
  actions,
}: {
  sprint: Sprint;
  progress: SprintProgress;
  actions?: React.ReactNode;
}) {
  const left = sprintTimeLeft(sprint.endDate);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{sprint.name}</h1>
        {sprint.startDate && sprint.endDate && (
          <span className="whitespace-nowrap text-xs text-ink-2" suppressHydrationWarning>
            {format(new Date(sprint.startDate), "MMM d")} – {format(new Date(sprint.endDate), "MMM d")}
            {left && (
              <>
                <span aria-hidden="true"> · </span>
                <span className={cn("font-medium", left.includes("over") ? "text-danger" : "text-ink")}>{left}</span>
              </>
            )}
          </span>
        )}
        {progress.totalIssues > 0 && <SprintProgressBar progress={progress} />}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {sprint.goal && <p className="text-xs text-ink-2">{sprint.goal}</p>}
    </div>
  );
}
