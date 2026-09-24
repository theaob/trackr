/**
 * The board's arithmetic, kept pure so it can be tested directly: how far a
 * sprint has got, how full a column is, where a card may move to, and the
 * board's filters written as TQL for the Issues page.
 */
import { differenceInCalendarDays } from "date-fns";
import type { IssueType, PriorityLevel } from "@/types";
import { allowedNextStatusNames, type WorkflowStatusLike, type WorkflowTransitionLike } from "@/lib/workflowDisplay";

type Category = "TODO" | "IN_PROGRESS" | "DONE";

export interface SprintProgress {
  /** Issue counts by status category. */
  issues: Record<Category, number>;
  /** Story points by status category. */
  points: Record<Category, number>;
  totalIssues: number;
  totalPoints: number;
}

/**
 * Where a sprint's issues stand, by the category of their status. Statuses
 * the workflow doesn't know count as to do, so nothing is dropped.
 */
export function sprintProgress(
  issues: { status: string; storyPoints?: number | null }[],
  statuses: { name: string; category: string }[]
): SprintProgress {
  const categoryOf = new Map(statuses.map((s) => [s.name, s.category]));
  const empty = (): Record<Category, number> => ({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  const result: SprintProgress = { issues: empty(), points: empty(), totalIssues: 0, totalPoints: 0 };
  for (const issue of issues) {
    const raw = categoryOf.get(issue.status);
    const category: Category = raw === "DONE" ? "DONE" : raw === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO";
    const points = Number(issue.storyPoints) || 0;
    result.issues[category] += 1;
    result.points[category] += points;
    result.totalIssues += 1;
    result.totalPoints += points;
  }
  return result;
}

/** "3 days left", "Ends today", "2 days over", by the viewer's calendar. */
export function sprintTimeLeft(endDate: string | Date | null | undefined, now: Date = new Date()): string | null {
  if (!endDate) return null;
  const days = differenceInCalendarDays(new Date(endDate), now);
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Ends today";
  return days === -1 ? "1 day over" : `${-days} days over`;
}

export type WipState = "none" | "under" | "at" | "over";

/** How full a column is against its WIP limit: amber at the limit, red over it. */
export function wipState(count: number, limit: number | null | undefined): WipState {
  if (!limit) return "none";
  if (count > limit) return "over";
  if (count === limit) return "at";
  return "under";
}

/**
 * The columns a card can be sent to from its menu: every board column the
 * workflow allows from its current status, other than the one it's in.
 */
export function moveTargets(
  currentStatus: string,
  columns: { id: string; title: string }[],
  statuses: WorkflowStatusLike[],
  transitions: WorkflowTransitionLike[]
): { id: string; title: string }[] {
  // With no transition data loaded yet, don't pretend nothing is allowed.
  const allowed = transitions.length ? new Set(allowedNextStatusNames(currentStatus, statuses, transitions)) : null;
  return columns.filter((c) => c.id !== currentStatus && (!allowed || allowed.has(c.id)));
}

export interface BoardFilterState {
  assigneeIds: string[];
  types: IssueType[];
  priorities: PriorityLevel[];
  onlyMine: boolean;
}

export const NO_BOARD_FILTERS: BoardFilterState = { assigneeIds: [], types: [], priorities: [], onlyMine: false };

export function hasBoardFilters(f: BoardFilterState): boolean {
  return f.onlyMine || f.assigneeIds.length > 0 || f.types.length > 0 || f.priorities.length > 0;
}

/** Whether an issue passes the board's chips (the text filter is applied separately). */
export function matchesBoardFilters(
  issue: { assigneeId: string | null; type: IssueType; priority: PriorityLevel },
  f: BoardFilterState,
  currentUserId?: string | null
): boolean {
  if (f.onlyMine && (!currentUserId || issue.assigneeId !== currentUserId)) return false;
  if (f.assigneeIds.length && (!issue.assigneeId || !f.assigneeIds.includes(issue.assigneeId))) return false;
  if (f.types.length && !f.types.includes(issue.type)) return false;
  if (f.priorities.length && !f.priorities.includes(issue.priority)) return false;
  return true;
}

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const list = (values: string[]) => (values.length === 1 ? `= ${quote(values[0])}` : `in (${values.map(quote).join(", ")})`);

/**
 * The board's filters as a TQL query, so "+ Filter" can carry on in the
 * Issues page, where any field can be queried.
 */
export function boardFiltersToTQL(projectKey: string, f: BoardFilterState, { sprintOnly }: { sprintOnly: boolean }): string {
  const clauses = [`project = ${quote(projectKey)}`];
  if (sprintOnly) clauses.push("sprint in openSprints()");
  if (f.onlyMine) clauses.push("assignee = currentUser()");
  if (f.assigneeIds.length) clauses.push(`assignee ${list(f.assigneeIds)}`);
  if (f.types.length) clauses.push(`type ${list(f.types)}`);
  if (f.priorities.length) clauses.push(`priority ${list(f.priorities)}`);
  return clauses.join(" AND ");
}

/**
 * Where a backlog row's menu can send an issue: the active sprint first,
 * then planned ones, then the backlog, leaving out where it already is.
 * Kanban projects have no sprints, and epics never go into one.
 */
export function backlogMoveTargets(
  issue: { sprintId: string | null; type: string },
  sprints: { id: string; name: string; status: string }[],
  isKanban: boolean
): { id: string | null; label: string; active?: boolean }[] {
  if (isKanban) return [];
  const targets: { id: string | null; label: string; active?: boolean }[] = [];
  if (issue.type !== "EPIC") {
    for (const status of ["ACTIVE", "FUTURE"]) {
      for (const s of sprints) {
        if (s.status === status && s.id !== issue.sprintId) targets.push({ id: s.id, label: s.name, active: status === "ACTIVE" });
      }
    }
  }
  if (issue.sprintId) targets.push({ id: null, label: "Backlog" });
  return targets;
}
