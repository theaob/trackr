/**
 * The five original statuses' exact display labels, from before workflows
 * were configurable. Splitting SHOUTING_SNAKE_CASE on "_" alone can't turn
 * "TODO" into "To Do" -- there's no delimiter to split on -- so an unedited
 * project needs its known names spelled out to look the same as it always
 * has, not just close to it.
 */
const LEGACY_STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

/**
 * A status name as a label. A custom status name is free text and is shown
 * as typed; anything else SHOUTING_SNAKE_CASE gets its underscores turned
 * into spaces so a hand-typed all-caps name still reads properly.
 */
export function prettifyStatusName(name?: string | null): string {
  if (!name) return "";
  if (LEGACY_STATUS_LABELS[name]) return LEGACY_STATUS_LABELS[name];
  if (/^[A-Z0-9_]+$/.test(name)) {
    return name.replace(/_/g, " ");
  }
  return name;
}

export interface WorkflowStatusLike {
  id: string;
  name: string;
}

export interface WorkflowTransitionLike {
  fromId: string;
  toId: string;
}

export const STANDARD_DONE_STATUS_NAMES = [
  "DONE",
  "Done",
  "done",
  "CLOSED",
  "Closed",
  "closed",
  "RESOLVED",
  "Resolved",
  "resolved",
  "COMPLETED",
  "Completed",
  "completed",
  "FINISHED",
  "Finished",
  "finished",
];

const STANDARD_DONE_SET = new Set([
  "DONE",
  "CLOSED",
  "RESOLVED",
  "COMPLETED",
  "FINISHED",
]);

export interface WorkflowStatusInfoLike {
  name: string;
  category?: string | null;
}

/**
 * Determines whether a given status name corresponds to a completed/done state.
 * Evaluates both the configured workflow statuses (matching category "DONE")
 * and standard completion status aliases (Done, Closed, Resolved, Completed, Finished).
 */
export function isDoneStatus(
  statusName?: string | null,
  workflowStatuses?: WorkflowStatusInfoLike[]
): boolean {
  if (!statusName) return false;
  const trimmed = statusName.trim();
  const upper = trimmed.toUpperCase();

  if (workflowStatuses && workflowStatuses.length > 0) {
    const match = workflowStatuses.find(
      (s) => s.name === trimmed || s.name.trim().toUpperCase() === upper
    );
    if (match && match.category) {
      return match.category.toUpperCase() === "DONE";
    }
  }

  return STANDARD_DONE_SET.has(upper);
}

/**
 * Returns the list of status names classified as "DONE".
 * Includes all statuses configured under the DONE category,
 * as well as common fallback aliases.
 */
export function getDoneStatusNames(
  workflowStatuses?: WorkflowStatusInfoLike[]
): string[] {
  const result: string[] = [];
  const seenUpper = new Set<string>();

  if (workflowStatuses) {
    for (const s of workflowStatuses) {
      if (s.category?.toUpperCase() === "DONE") {
        result.push(s.name);
        seenUpper.add(s.name.toUpperCase());
      }
    }
  }

  for (const fallback of STANDARD_DONE_STATUS_NAMES) {
    if (!seenUpper.has(fallback.toUpperCase())) {
      result.push(fallback);
      seenUpper.add(fallback.toUpperCase());
    }
  }

  return result;
}

/**
 * Status names an issue can move to from its current one, per the project's
 * transition graph, always including the current status itself (so the
 * dropdown shows where the issue already is).
 */
export function allowedNextStatusNames(
  currentStatusName: string,
  statuses: WorkflowStatusLike[],
  transitions: WorkflowTransitionLike[]
): string[] {
  const current = statuses.find(
    (s) =>
      s.name === currentStatusName ||
      s.name.trim().toUpperCase() === currentStatusName.trim().toUpperCase()
  );
  if (!current) return [currentStatusName];

  const nextIds = new Set(
    transitions.filter((t) => t.fromId === current.id).map((t) => t.toId)
  );
  const names = statuses.filter((s) => nextIds.has(s.id)).map((s) => s.name);
  return Array.from(new Set([currentStatusName, ...names]));
}
