"use client";

import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import type { Issue, IssueStatus } from "@/types";
import { cn } from "@/components/ui/cn";
import { wipState } from "@/lib/board";
import IssueCard, { type CardMoveOptions } from "./IssueCard";

interface KanbanColumnProps {
  id: IssueStatus;
  droppableId?: string;
  title: string;
  color?: string | null;
  issues: Issue[];
  wipLimit?: number;
  onIssueClick: (issue: Issue) => void;
  showHeader?: boolean;
  minHeightClass?: string;
  doneStatusNames?: string[];
  onSelectEpic?: (epicIdOrKey: string) => void;
  columnRef?: (el: HTMLDivElement | null) => void;
  canMove?: boolean;
  /** The card menu's move options for each card. */
  moveOptions?: (issue: Issue, index: number, cellSize: number) => CardMoveOptions;
}

/** The count in a column header: "3", or "3 / 4" against a WIP limit, amber at it and red over it. */
export function ColumnCount({ count, limit }: { count: number; limit?: number | null }) {
  const state = wipState(count, limit);
  const description =
    state === "none"
      ? `${count} ${count === 1 ? "issue" : "issues"}`
      : `${count} of a work-in-progress limit of ${limit}${state === "at" ? ", at the limit" : state === "over" ? ", over the limit" : ""}`;
  return (
    <span
      title={description}
      className={cn(
        "rounded-full px-1.5 font-mono text-[11px] leading-5",
        state === "over"
          ? "bg-danger-soft font-semibold text-danger"
          : state === "at"
            ? "bg-warning-soft font-semibold text-warning"
            : "text-ink-2"
      )}
    >
      <span aria-hidden="true">{limit ? `${count} / ${limit}` : count}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

export function ColumnTitle({ title, color }: { title: string; color?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-strong" style={color ? { backgroundColor: color } : undefined} />
      <span className="truncate text-[13px] font-semibold text-ink">{title}</span>
    </span>
  );
}

/**
 * One status on the board. On a phone each column is most of the screen
 * wide and snaps into place; from md up the board lays them out in equal
 * shares of the width.
 */
export default function KanbanColumn({
  id,
  droppableId,
  title,
  color,
  issues,
  wipLimit,
  onIssueClick,
  showHeader = true,
  minHeightClass = "min-h-[150px]",
  doneStatusNames,
  onSelectEpic,
  columnRef,
  canMove = true,
  moveOptions,
}: KanbanColumnProps) {
  return (
    <section
      ref={columnRef}
      aria-label={showHeader ? title : undefined}
      className="flex max-h-full w-[calc(100vw-1.5rem)] shrink-0 snap-center snap-always sm:w-[calc(100vw-3rem)] flex-col rounded-card bg-surface-sunk p-2 md:w-auto md:max-w-none md:shrink md:min-w-0"
    >
      {showHeader && (
        <div className="flex h-8 items-center justify-between gap-2 px-1.5">
          <h3 className="min-w-0">
            <ColumnTitle title={title} color={color} />
          </h3>
          <ColumnCount count={issues.length} limit={wipLimit} />
        </div>
      )}

      <Droppable droppableId={droppableId || id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 overflow-y-auto rounded-control px-0.5 py-1 transition-colors",
              minHeightClass,
              snapshot.isDraggingOver && "bg-accent-soft"
            )}
          >
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onClick={() => onIssueClick(issue)}
                doneStatusNames={doneStatusNames}
                onSelectEpic={onSelectEpic}
                canMove={canMove}
                move={moveOptions?.(issue, index, issues.length)}
              />
            ))}
            {provided.placeholder}

            {issues.length === 0 && !snapshot.isDraggingOver && (
              <p className="flex h-20 select-none items-center justify-center rounded-control border border-dashed border-strong text-xs text-ink-2">
                No issues
              </p>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
}
