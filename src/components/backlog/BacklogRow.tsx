"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ArrowDownToLine, ArrowUpToLine, CalendarClock, Copy, ExternalLink, GripVertical, Link2, MoreHorizontal } from "lucide-react";
import type { Issue } from "@/types";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { issueHref, projectKeyOfIssue } from "@/lib/issueUrls";
import { cn } from "@/components/ui/cn";
import { formatCalendarDate } from "@/lib/calendarDate";
import { isOverdue } from "@/lib/dueDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";

const PRIORITY_NAMES: Record<string, string> = { HIGHEST: "Highest", HIGH: "High", MEDIUM: "Medium", LOW: "Low", LOWEST: "Lowest" };

export interface BacklogRowProps {
  issue: Issue;
  index: number;
  statusColor?: string | null;
  doneStatusNames: string[];
  /** Why the row can't be dragged right now, or nothing if it can. */
  dragBlockedReason?: string | null;
  canDrag: boolean;
  selectable: boolean;
  selected: boolean;
  onSelect: (mode: "toggle" | "range") => void;
  onOpen: () => void;
  /** Sprints (or the backlog) the menu can move the issue to. */
  moveTargets: { id: string | null; label: string; active?: boolean }[];
  onMove: (sprintId: string | null) => void;
  /** Top or bottom of its section; absent while reordering is paused. */
  onReorder?: (edge: "top" | "bottom") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMove: boolean;
}

/**
 * One issue in a sprint or the backlog, laid out like a row of the Issues
 * table so the columns line up across sections. Click opens it; ⌘/Ctrl-click
 * or the checkbox selects it, and Shift-click selects a range.
 */
export default function BacklogRow({
  issue,
  index,
  statusColor,
  doneStatusNames,
  dragBlockedReason,
  canDrag,
  selectable,
  selected,
  onSelect,
  onOpen,
  moveTargets,
  onMove,
  onReorder,
  canMoveUp,
  canMoveDown,
  canMove,
}: BacklogRowProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pending = issue.id.startsWith("temp-");
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Copied ${what}`, tone: "success", duration: 2500 });
    } catch {
      toast({ title: `Couldn't copy ${what}`, tone: "danger" });
    }
  };
  const showMoves = canMove && !pending && (moveTargets.length > 0 || (onReorder && (canMoveUp || canMoveDown)));
  const overdue = !!issue.dueDate && isOverdue(issue.dueDate, issue.status, doneStatusNames);

  return (
    <Draggable draggableId={issue.id} index={index} isDragDisabled={!canDrag}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={(e) => {
            if (selectable && (e.shiftKey || e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSelect(e.shiftKey ? "range" : "toggle");
              return;
            }
            onOpen();
          }}
          onContextMenu={(e) => {
            // Right-click opens the row's menu, the same one as its "…" button.
            e.preventDefault();
            setMenuOpen(true);
          }}
          data-selected={selected || undefined}
          className={cn(
            "group flex min-h-10 cursor-pointer flex-wrap items-center gap-x-2 border-b border-subtle bg-surface px-2 py-1 text-[13px] transition-colors last:border-b-0 hover:bg-surface-sunk sm:flex-nowrap sm:py-0",
            "data-[selected]:bg-accent-soft",
            snapshot.isDragging && "rounded-control border border-accent shadow-overlay",
            pending && "opacity-60"
          )}
        >
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              disabled={pending}
              aria-label={`Select ${issue.key}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(e.shiftKey ? "range" : "toggle");
              }}
              onChange={() => {}}
              className="h-4 w-4 shrink-0 cursor-pointer rounded-[4px] accent-[rgb(var(--color-accent))] md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 md:data-[checked=true]:opacity-100"
              data-checked={selected}
            />
          )}
          <span
            {...(canDrag ? provided.dragHandleProps : {})}
            aria-label={canDrag ? `Drag ${issue.key}` : undefined}
            title={dragBlockedReason ?? (canDrag ? "Drag to reorder, or to move to another sprint" : undefined)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "hidden h-6 w-4 shrink-0 items-center justify-center text-muted sm:inline-flex",
              canDrag ? "cursor-grab hover:text-ink active:cursor-grabbing" : "cursor-default opacity-40"
            )}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </span>

          <IssueTypeIcon type={issue.type} className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate font-mono text-xs text-ink-2 sm:w-[84px] sm:flex-none sm:shrink-0">{issue.key}</span>

          {/* On a phone the title gets its own line under the key. */}
          <button
            type="button"
            className="order-last w-full min-w-0 pb-1.5 pl-6 text-left text-ink sm:order-none sm:w-auto sm:flex-1 sm:truncate sm:py-2 sm:pl-0"
          >
            {issue.title}
          </button>

          {issue.parent && (
            <span
              className="hidden max-w-[160px] shrink-0 truncate rounded-[4px] bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-800 md:inline"
              title={`Epic: ${issue.parent.title}`}
            >
              {issue.parent.title}
            </span>
          )}
          {issue.labels && issue.labels.length > 0 && (
            <span className="hidden shrink-0 items-center gap-1 lg:flex">
              {issue.labels.slice(0, 2).map((il) => (
                <span key={il.id} className="rounded-full border border-subtle bg-surface-sunk px-1.5 text-[11px] leading-4 text-ink-2">
                  {il.label.name}
                </span>
              ))}
              {issue.labels.length > 2 && <span className="text-[11px] text-ink-2">+{issue.labels.length - 2}</span>}
            </span>
          )}

          {issue.dueDate && (
            <span
              className={cn(
                "hidden shrink-0 items-center gap-1 text-xs sm:inline-flex",
                overdue ? "font-medium text-danger" : "text-ink-2"
              )}
              title={`Due ${formatCalendarDate(issue.dueDate, "MMM d, yyyy")}${overdue ? " (overdue)" : ""}`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{overdue ? "Overdue, due" : "Due"}</span>
              {formatCalendarDate(issue.dueDate, "MMM d")}
            </span>
          )}

          <span className="flex w-[104px] shrink-0 justify-end">
            <StatusLozenge label={prettifyStatusName(issue.status)} color={statusColor ?? undefined} className="max-w-full" />
          </span>
          <span
            className="hidden w-5 shrink-0 justify-center sm:flex"
            title={`Priority: ${PRIORITY_NAMES[issue.priority] ?? issue.priority}`}
          >
            <PriorityIcon priority={issue.priority} className="h-4 w-4" />
            <span className="sr-only">Priority: {PRIORITY_NAMES[issue.priority] ?? issue.priority}</span>
          </span>
          <span className="w-7 shrink-0 text-center font-mono text-xs text-ink-2">
            {issue.storyPoints ?? <span aria-hidden="true">–</span>}
            {issue.storyPoints !== null && issue.storyPoints !== undefined ? (
              <span className="sr-only"> points</span>
            ) : (
              <span className="sr-only">No estimate</span>
            )}
          </span>
          <span className="flex w-6 shrink-0 justify-center">
            {issue.assignee ? (
              <UserAvatar user={issue.assignee} size="xs" showTooltip tooltipPrefix="Assignee" />
            ) : (
              <span title="Unassigned" className="h-5 w-5 rounded-full border border-dashed border-strong">
                <span className="sr-only">Unassigned</span>
              </span>
            )}
          </span>
          <Menu open={menuOpen} onOpenChange={setMenuOpen}>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${issue.key}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink data-[state=open]:opacity-100 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </MenuTrigger>
            <MenuContent align="end" onClick={(e) => e.stopPropagation()} className="max-h-96 overflow-y-auto">
              <MenuItem icon={<ExternalLink aria-hidden="true" />} onSelect={onOpen}>
                Open
              </MenuItem>
              <MenuItem icon={<Copy aria-hidden="true" />} onSelect={() => copy(issue.key, issue.key)}>
                Copy key
              </MenuItem>
              <MenuItem
                icon={<Link2 aria-hidden="true" />}
                onSelect={() =>
                  copy(
                    new URL(issueHref(projectKeyOfIssue(issue.key), issue.key), window.location.origin).toString(),
                    `a link to ${issue.key}`
                  )
                }
              >
                Copy link
              </MenuItem>
              {showMoves && (
                <>
                  <MenuSeparator />
                  {moveTargets.length > 0 && <MenuLabel>Move to</MenuLabel>}
                  {moveTargets.map((t) => (
                    <MenuItem key={t.id ?? "backlog"} onSelect={() => onMove(t.id)}>
                      {t.label}
                      {t.active && <span className="ml-2 text-xs text-ink-2">Active</span>}
                    </MenuItem>
                  ))}
                  {onReorder && canMoveUp && (
                    <MenuItem icon={<ArrowUpToLine aria-hidden="true" />} onSelect={() => onReorder("top")}>
                      Move to top
                    </MenuItem>
                  )}
                  {onReorder && canMoveDown && (
                    <MenuItem icon={<ArrowDownToLine aria-hidden="true" />} onSelect={() => onReorder("bottom")}>
                      Move to bottom
                    </MenuItem>
                  )}
                </>
              )}
              {canMove && issue.type === "EPIC" && moveTargets.length <= 1 && (
                <p className="px-2 py-1.5 text-xs text-ink-2">Epics can&apos;t be planned into a sprint.</p>
              )}
            </MenuContent>
          </Menu>
        </div>
      )}
    </Draggable>
  );
}
