"use client";

import React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Issue } from "@/types";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { cn } from "@/components/ui/cn";
import { COLUMNS, type ColumnId, type IssueSort, type SortField } from "@/lib/issueQuery";
import { issueHref, projectKeyOfIssue } from "@/lib/issueUrls";
import { formatCalendarDate } from "@/lib/calendarDate";
import { isOverdue } from "@/lib/dueDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";

export type Density = "comfortable" | "compact";

const PRIORITY_NAMES: Record<string, string> = { HIGHEST: "Highest", HIGH: "High", MEDIUM: "Medium", LOW: "Low", LOWEST: "Lowest" };
const WIDTH: Partial<Record<ColumnId, string>> = {
  type: "w-10",
  key: "w-28",
  status: "w-36",
  priority: "w-20",
  points: "w-16",
  assignee: "w-40",
  reporter: "w-40",
  sprint: "w-36",
  version: "w-28",
  labels: "w-40",
  due: "w-24",
  created: "w-24",
  updated: "w-24",
};

function Person({ user }: { user?: { name: string; avatarUrl: string | null } | null }) {
  if (!user) return <span className="text-ink-2">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <UserAvatar user={user as never} size="xs" />
      <span className="truncate">{user.name}</span>
    </span>
  );
}

/**
 * The Issues table: the view's columns, headers that sort, a checkbox per row
 * for bulk actions, and a compact density for long lists.
 */
export default function IssueTable({
  issues,
  columns,
  sort,
  onSort,
  density,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
  statusColor,
  doneStatusNames,
}: {
  issues: Issue[];
  columns: ColumnId[];
  sort: IssueSort;
  onSort: (field: SortField) => void;
  density: Density;
  selectable: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (issue: Issue) => void;
  statusColor: (name: string) => string | undefined;
  doneStatusNames: string[];
}) {
  const shown = COLUMNS.filter((c) => columns.includes(c.id));
  const allSelected = issues.length > 0 && issues.every((i) => selectedIds.has(i.id));
  const someSelected = issues.some((i) => selectedIds.has(i.id));
  const cell = density === "compact" ? "h-8 px-2 text-xs" : "h-10 px-2.5 text-[13px]";

  const render = (issue: Issue, id: ColumnId) => {
    switch (id) {
      case "type":
        return <IssueTypeIcon type={issue.type} className="h-4 w-4" />;
      case "key":
        return (
          <Link
            prefetch={false}
            href={issueHref(issue.project?.key ?? projectKeyOfIssue(issue.key), issue.key)}
            onClick={(e) => {
              // A plain click opens the panel; ⌘/Ctrl-click still opens a tab.
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              onOpen(issue);
            }}
            className="font-mono text-xs text-ink-2 hover:text-ink hover:underline"
          >
            {issue.key}
          </Link>
        );
      case "title":
        return (
          <button type="button" onClick={() => onOpen(issue)} className="block w-full truncate text-left text-ink">
            {issue.title}
          </button>
        );
      case "status":
        return <StatusLozenge label={prettifyStatusName(issue.status)} color={statusColor(issue.status)} />;
      case "priority":
        return (
          <span className="flex items-center gap-1.5 text-ink-2">
            <PriorityIcon priority={issue.priority} className="h-4 w-4" />
            {density === "comfortable" ? PRIORITY_NAMES[issue.priority] : <span className="sr-only">{PRIORITY_NAMES[issue.priority]}</span>}
          </span>
        );
      case "points":
        return <span className="font-mono text-ink-2">{issue.storyPoints ?? "–"}</span>;
      case "assignee":
        return <Person user={issue.assignee} />;
      case "reporter":
        return <Person user={issue.reporter} />;
      case "sprint":
        return <span className="truncate text-ink-2">{issue.sprint?.name ?? "Backlog"}</span>;
      case "version":
        return <span className="truncate text-ink-2">{issue.version?.name ?? "–"}</span>;
      case "labels":
        return (
          <span className="flex min-w-0 gap-1 overflow-hidden">
            {(issue.labels ?? []).map((l) => (
              <span key={l.id} className="shrink-0 rounded-full border border-subtle bg-surface-sunk px-1.5 text-[11px] leading-4 text-ink-2">
                {l.label.name}
              </span>
            ))}
          </span>
        );
      case "due": {
        if (!issue.dueDate) return <span className="text-ink-2">–</span>;
        const late = isOverdue(issue.dueDate, issue.status, doneStatusNames);
        return (
          <span className={late ? "font-medium text-danger" : "text-ink-2"}>
            {late && <span className="sr-only">Overdue, </span>}
            {formatCalendarDate(issue.dueDate, "MMM d")}
          </span>
        );
      }
      case "created":
        return <span className="text-ink-2">{formatCalendarDate(issue.createdAt, "MMM d")}</span>;
      case "updated":
        return <span className="text-ink-2">{formatCalendarDate(issue.updatedAt, "MMM d")}</span>;
    }
  };

  return (
    <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr>
          {selectable && (
            <th scope="col" className="w-9 border-b border-subtle px-2">
              <input
                type="checkbox"
                aria-label="Select every issue on this page"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={onToggleAll}
                className="h-4 w-4 cursor-pointer accent-[rgb(var(--color-accent))]"
              />
            </th>
          )}
          {shown.map((c) => {
            const sorted = c.sort && sort.field === c.sort;
            return (
              <th
                key={c.id}
                scope="col"
                aria-sort={sorted ? (sort.direction === "ASC" ? "ascending" : "descending") : undefined}
                className={cn("h-9 border-b border-subtle px-2 text-left text-xs font-medium text-ink-2", WIDTH[c.id])}
              >
                {c.id === "type" ? (
                  <span className="sr-only">Type</span>
                ) : c.sort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.sort!)}
                    className={cn("-mx-1 inline-flex items-center gap-1 rounded-control px-1 py-0.5 hover:bg-surface-sunk hover:text-ink", sorted && "text-ink")}
                  >
                    {c.label}
                    {sorted ? (
                      sort.direction === "ASC" ? (
                        <ArrowUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => {
          const selected = selectedIds.has(issue.id);
          return (
            <tr
              key={issue.id}
              data-selected={selected || undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a, button, input")) return;
                onOpen(issue);
              }}
              className="cursor-pointer hover:bg-surface-sunk data-[selected]:bg-accent-soft"
            >
              {selectable && (
                <td className={cn("border-b border-subtle", cell)}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${issue.key}`}
                    checked={selected}
                    onChange={() => onToggle(issue.id)}
                    className="h-4 w-4 cursor-pointer accent-[rgb(var(--color-accent))]"
                  />
                </td>
              )}
              {shown.map((c) => (
                <td key={c.id} className={cn("overflow-hidden border-b border-subtle", cell)}>
                  {render(issue, c.id)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
