"use client";

import React, { useId } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";

export interface BacklogSectionProps {
  droppableId: string;
  title: React.ReactNode;
  /** Plain-text name, for labels. */
  name: string;
  active?: boolean;
  /** Dates, or a button to add them. */
  dates?: React.ReactNode;
  issueCount: number;
  points?: { total: number; done?: number };
  goal?: string | null;
  /** Start or Complete: the one action that sits in the header. */
  primaryAction?: React.ReactNode;
  /** Everything else, in the section's menu. */
  menu?: React.ReactNode;
  reorderPaused?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  emptyText: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A sprint, or the backlog: a one-line header (name, dates, issue count and
 * points, one primary action and a menu) over rows that line up with every
 * other section.
 */
export default function BacklogSection({
  droppableId,
  title,
  name,
  active,
  dates,
  issueCount,
  points,
  goal,
  primaryAction,
  menu,
  reorderPaused,
  collapsed,
  onToggleCollapsed,
  emptyText,
  footer,
  children,
}: BacklogSectionProps) {
  const headingId = useId();
  const bodyId = useId();
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-card border border-subtle bg-surface shadow-raised">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle bg-surface-sunk/60 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? `Show ${name}` : `Hide ${name}`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">
          {title}
        </h2>
        {active && <span className="rounded-full bg-success-soft px-2 text-[11px] font-medium leading-5 text-success">Active</span>}
        {dates && <span className="text-xs text-ink-2">{dates}</span>}
        <span className="text-xs text-ink-2">
          {issueCount} {issueCount === 1 ? "issue" : "issues"}
          {points && points.total > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              {points.done !== undefined ? `${points.done} of ${points.total} pts done` : `${points.total} pts`}
            </>
          )}
        </span>
        {reorderPaused && <span className="text-xs text-ink-2">Reordering is paused while filtered</span>}
        {(primaryAction || menu) && (
          <div className="ml-auto flex items-center gap-1">
            {primaryAction}
            {menu}
          </div>
        )}
        {goal && <p className="w-full truncate pl-9 text-xs text-ink-2">{goal}</p>}
      </div>

      <div id={bodyId} hidden={collapsed}>
        {!collapsed && (
          <>
            <Droppable droppableId={droppableId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("min-h-2 transition-colors", snapshot.isDraggingOver && "bg-accent-soft")}
                >
                  {children}
                  {provided.placeholder}
                  {issueCount === 0 && !snapshot.isDraggingOver && <p className="px-3 py-4 text-center text-xs text-ink-2">{emptyText}</p>}
                </div>
              )}
            </Droppable>
            {footer && <div className="border-t border-subtle">{footer}</div>}
          </>
        )}
      </div>
    </section>
  );
}
