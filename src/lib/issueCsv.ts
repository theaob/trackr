/**
 * The Issues export: the columns on screen, as CSV a spreadsheet opens
 * safely. Cells that a spreadsheet would run as a formula (=, +, -, @) are
 * prefixed with an apostrophe, and quotes, commas and line breaks are escaped.
 */
import type { Issue } from "@/types";
import { COLUMNS, type ColumnId } from "@/lib/issueQuery";
import { calendarDateKey } from "@/lib/calendarDate";

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function valueOf(issue: Issue, column: ColumnId): string | number | null {
  switch (column) {
    case "type":
      return issue.type;
    case "key":
      return issue.key;
    case "title":
      return issue.title;
    case "status":
      return issue.status;
    case "priority":
      return issue.priority;
    case "points":
      return issue.storyPoints;
    case "assignee":
      return issue.assignee?.name ?? "";
    case "reporter":
      return issue.reporter?.name ?? "";
    case "sprint":
      return issue.sprint?.name ?? "";
    case "version":
      return issue.version?.name ?? "";
    case "labels":
      return (issue.labels ?? []).map((l) => l.label.name).join("; ");
    case "due":
      return issue.dueDate ? calendarDateKey(issue.dueDate) : "";
    case "created":
      return new Date(issue.createdAt).toISOString().slice(0, 10);
    case "updated":
      return new Date(issue.updatedAt).toISOString().slice(0, 10);
  }
}

export function issuesToCSV(issues: Issue[], columns: ColumnId[]): string {
  const shown = COLUMNS.filter((c) => columns.includes(c.id));
  const header = shown.map((c) => csvCell(c.label)).join(",");
  const rows = issues.map((issue) => shown.map((c) => csvCell(valueOf(issue, c.id))).join(","));
  return [header, ...rows].join("\r\n");
}
