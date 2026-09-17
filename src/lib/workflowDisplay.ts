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
export function prettifyStatusName(name: string): string {
  if (!name) return name;
  if (LEGACY_STATUS_LABELS[name]) return LEGACY_STATUS_LABELS[name];
  if (/^[A-Z0-9_]+$/.test(name)) {
    return name.replace(/_/g, " ");
  }
  return name;
}

interface WorkflowStatusLike {
  id: string;
  name: string;
}

interface WorkflowTransitionLike {
  fromId: string;
  toId: string;
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
  const current = statuses.find((s) => s.name === currentStatusName);
  if (!current) return [currentStatusName];

  const nextIds = new Set(
    transitions.filter((t) => t.fromId === current.id).map((t) => t.toId)
  );
  const names = statuses.filter((s) => nextIds.has(s.id)).map((s) => s.name);
  return Array.from(new Set([currentStatusName, ...names]));
}
