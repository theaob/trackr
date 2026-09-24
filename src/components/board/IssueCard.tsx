"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ArrowDownToLine, ArrowUpToLine, CalendarClock, CheckSquare, ExternalLink, Link2, MoreHorizontal } from "lucide-react";
import type { Issue } from "@/types";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { isOverdue } from "@/lib/dueDate";
import { formatCalendarDate } from "@/lib/calendarDate";
import { issueHref, projectKeyOfIssue } from "@/lib/issueUrls";
import { Tooltip } from "@/components/ui/Popover";

export interface CardMoveOptions {
  /** Columns the workflow lets this card move to. */
  targets: { id: string; title: string }[];
  onMove: (statusId: string) => void;
  /** Reordering within the column, for when dragging isn't an option. */
  onMoveToEdge?: (edge: "top" | "bottom") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

interface IssueCardProps {
  issue: Issue;
  index: number;
  onClick: () => void;
  doneStatusNames?: string[];
  onSelectEpic?: (epicIdOrKey: string) => void;
  canMove?: boolean;
  move?: CardMoveOptions;
}

const PRIORITY_NAMES: Record<string, string> = { HIGHEST: "Highest", HIGH: "High", MEDIUM: "Medium", LOW: "Low", LOWEST: "Lowest" };

/**
 * A card on the board. Dragging (or Space and the arrow keys) moves it, and
 * so does its menu, so moving a card never depends on dragging.
 */
export default function IssueCard({
  issue,
  index,
  onClick,
  doneStatusNames = ["DONE"],
  onSelectEpic,
  canMove = true,
  move,
}: IssueCardProps) {
  const { toast } = useToast();
  const doneChildren = issue.children?.filter((c) => doneStatusNames.includes(c.status)).length ?? 0;
  const totalChildren = issue.children?.length ?? 0;
  const overdue = !!issue.dueDate && isOverdue(issue.dueDate, issue.status, doneStatusNames);
  const href = issueHref(issue.project?.key ?? projectKeyOfIssue(issue.key), issue.key);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      toast({ title: `Copied a link to ${issue.key}`, tone: "success", duration: 2500 });
    } catch {
      toast({ title: "Couldn't copy the link", tone: "danger" });
    }
  };

  return (
    <Draggable draggableId={issue.id} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} className="group relative mb-2">
          <div
            {...(canMove ? provided.dragHandleProps : { role: "button", tabIndex: 0 })}
            aria-label={`${issue.key}: ${issue.title}`}
            onClick={onClick}
            onKeyDown={(e) => {
              // Space lifts the card for keyboard dragging; Enter opens it.
              if (e.key === "Enter") {
                e.preventDefault();
                onClick();
              }
            }}
            className={cn(
              "cursor-pointer select-none rounded-card border bg-surface px-card-x py-card-y pr-9 text-left shadow-raised transition-[border-color,box-shadow] duration-150",
              "hover:border-strong",
              snapshot.isDragging ? "border-accent shadow-overlay" : "border-subtle"
            )}
          >
            {issue.parent && (
              <Tooltip content={`Epic: ${issue.parent.title || issue.parent.key}`}>
                <span className="mb-1.5 inline-block max-w-full truncate rounded-[4px] bg-epic-soft px-1.5 py-0.5 text-[11px] font-medium text-epic">
                  <span className="sr-only">Epic: </span>
                  {issue.parent.title || issue.parent.key}
                </span>
              </Tooltip>
            )}

            <p className="line-clamp-3 text-[13px] leading-snug text-ink">{issue.title}</p>

            {issue.labels && issue.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {issue.labels.map((il) => (
                  <span key={il.id} className="rounded-full border border-subtle bg-surface-sunk px-1.5 text-[11px] leading-4 text-ink-2">
                    {il.label.name}
                  </span>
                ))}
              </div>
            )}

            {totalChildren > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
                <CheckSquare className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                <span>
                  {doneChildren}/{totalChildren} subtasks
                </span>
                <span aria-hidden="true" className="h-1 w-12 overflow-hidden rounded-full bg-surface-sunk">
                  <span className="block h-full rounded-full bg-success" style={{ width: `${(doneChildren / totalChildren) * 100}%` }} />
                </span>
              </div>
            )}

            {/* One 12-pixel line: type, key, priority, due date, points, assignee */}
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <IssueTypeIcon type={issue.type} className="h-4 w-4 shrink-0" />
              <span className="font-mono text-ink-2">{issue.key}</span>
              <Tooltip content={`Priority: ${PRIORITY_NAMES[issue.priority] ?? issue.priority}`}>
                <span className="inline-flex shrink-0">
                  <span aria-hidden="true" className="inline-flex">
                    <PriorityIcon priority={issue.priority} className="h-4 w-4" />
                  </span>
                  <span className="sr-only">Priority: {PRIORITY_NAMES[issue.priority] ?? issue.priority}</span>
                </span>
              </Tooltip>
              {issue.dueDate && (
                <Tooltip content={`Due ${formatCalendarDate(issue.dueDate, "MMM d, yyyy")}${overdue ? " (overdue)" : ""}`}>
                <span className={cn("inline-flex items-center gap-0.5", overdue ? "font-medium text-danger" : "text-ink-2")}>
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{overdue ? "Overdue, due" : "Due"}</span>
                  {formatCalendarDate(issue.dueDate, "MMM d")}
                </span>
                </Tooltip>
              )}
              <span className="ml-auto flex items-center gap-2">
                {issue.storyPoints !== null && issue.storyPoints !== undefined && (
                  <span className="min-w-[20px] rounded-full bg-surface-sunk px-1.5 text-center font-mono text-[11px] leading-5 text-ink-2">
                    {issue.storyPoints}
                    <span className="sr-only"> points</span>
                  </span>
                )}
                {issue.assignee ? (
                  <UserAvatar user={issue.assignee} size="xs" showTooltip tooltipPrefix="Assignee" />
                ) : (
                  <Tooltip content="Unassigned">
                    <span className="h-5 w-5 rounded-full border border-dashed border-strong">
                      <span className="sr-only">Unassigned</span>
                    </span>
                  </Tooltip>
                )}
              </span>
            </div>
          </div>

          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${issue.key}`}
                onKeyDown={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-control text-muted transition-opacity hover:bg-surface-sunk hover:text-ink",
                  "md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 md:data-[state=open]:opacity-100"
                )}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<ExternalLink aria-hidden="true" />} onSelect={onClick}>
                Open
              </MenuItem>
              {issue.parent && onSelectEpic && (
                <MenuItem icon={<IssueTypeIcon type="EPIC" className="h-4 w-4" />} onSelect={() => onSelectEpic(issue.parent!.id)}>
                  Open epic
                </MenuItem>
              )}
              <MenuItem icon={<Link2 aria-hidden="true" />} onSelect={copyLink}>
                Copy link
              </MenuItem>
              {canMove && move && (move.targets.length > 0 || move.canMoveUp || move.canMoveDown) && (
                <>
                  <MenuSeparator />
                  {move.targets.length > 0 && <MenuLabel>Move to</MenuLabel>}
                  {move.targets.map((t) => (
                    <MenuItem key={t.id} onSelect={() => move.onMove(t.id)}>
                      {t.title}
                    </MenuItem>
                  ))}
                  {move.onMoveToEdge && move.canMoveUp && (
                    <MenuItem icon={<ArrowUpToLine aria-hidden="true" />} onSelect={() => move.onMoveToEdge!("top")}>
                      Move to top
                    </MenuItem>
                  )}
                  {move.onMoveToEdge && move.canMoveDown && (
                    <MenuItem icon={<ArrowDownToLine aria-hidden="true" />} onSelect={() => move.onMoveToEdge!("bottom")}>
                      Move to bottom
                    </MenuItem>
                  )}
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      )}
    </Draggable>
  );
}
