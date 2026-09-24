/**
 * The issue view's Activity: comments and the change history in one list,
 * newest first, with tabs that narrow it to either. Both lists arrive a page
 * at a time (see issueHistory.ts), which the merged view has to respect: it
 * mustn't show an old comment beneath a gap of history that hasn't loaded.
 */
import type { Issue } from "@/types";
import { historyRemaining, type HistoryKind } from "@/lib/issueHistory";
import { prettifyStatusName } from "@/lib/workflowDisplay";

export type ActivityFilter = "all" | "comments" | "history";

export type ActivityEntry =
  | { kind: "comment"; id: string; createdAt: string | Date; comment: any }
  | { kind: "history"; id: string; createdAt: string | Date; log: any };

export interface ActivityPage {
  entries: ActivityEntry[];
  /** Entries that exist but aren't shown yet: unloaded, or held back below a gap. */
  remaining: number;
  /** Which lists "Show older" should fetch the next page of. */
  loadKinds: HistoryKind[];
}

const time = (value: string | Date) => new Date(value).getTime();
const isPlaceholder = (entry: { id: string }) => String(entry.id).startsWith("temp-");

/**
 * The entries to show for a tab. On "all", entries older than the oldest one
 * loaded from a list that still has more are held back until that list's next
 * page arrives, so the two lists interleave correctly. A comment's own
 * "commented" history entry is left out there, since the comment is shown.
 */
export function activityPage(issue: Issue, filter: ActivityFilter): ActivityPage {
  const comments: any[] = issue.comments ?? [];
  const logs: any[] = issue.activityLogs ?? [];
  const commentEntries: ActivityEntry[] = comments.map((c) => ({ kind: "comment", id: c.id, createdAt: c.createdAt, comment: c }));
  const logEntries: ActivityEntry[] = logs.map((l) => ({ kind: "history", id: l.id, createdAt: l.createdAt, log: l }));
  const moreComments = historyRemaining(issue, "comments");
  const moreHistory = historyRemaining(issue, "activity");

  if (filter === "comments") {
    return { entries: commentEntries, remaining: moreComments, loadKinds: moreComments > 0 ? ["comments"] : [] };
  }
  if (filter === "history") {
    return { entries: logEntries, remaining: moreHistory, loadKinds: moreHistory > 0 ? ["activity"] : [] };
  }

  const oldestLoaded = (list: any[]) => {
    const loaded = list.filter((e) => !isPlaceholder(e));
    return loaded.length ? Math.min(...loaded.map((e) => time(e.createdAt))) : null;
  };
  let cutoff = -Infinity;
  const loadKinds: HistoryKind[] = [];
  for (const [kind, list, more] of [
    ["comments", comments, moreComments],
    ["activity", logs, moreHistory],
  ] as const) {
    if (more <= 0) continue;
    loadKinds.push(kind);
    const oldest = oldestLoaded(list);
    if (oldest !== null) cutoff = Math.max(cutoff, oldest);
  }

  const merged = [...commentEntries, ...logEntries.filter((e) => e.kind === "history" && e.log.action !== "COMMENTED")].sort(
    (a, b) => time(b.createdAt) - time(a.createdAt)
  );
  const entries = merged.filter((e) => isPlaceholder(e) || time(e.createdAt) >= cutoff);
  const heldBack = merged.length - entries.length;
  return { entries, remaining: moreComments + moreHistory + heldBack, loadKinds };
}

export interface ActivityDescription {
  /** What happened, after the person's name: "changed the status". */
  verb: string;
  from?: string | null;
  to?: string | null;
}

const PRIORITY_NAMES: Record<string, string> = {
  HIGHEST: "Highest",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  LOWEST: "Lowest",
};

/**
 * A history entry in words. Assignee changes store user ids, so `userName`
 * turns those back into names (falling back to the stored value).
 */
export function describeActivity(
  log: { action: string; field?: string | null; oldValue?: string | null; newValue?: string | null },
  userName: (id: string) => string | undefined = () => undefined
): ActivityDescription {
  const person = (value?: string | null) => (!value || value === "Unassigned" ? "Unassigned" : (userName(value) ?? value));
  switch (log.action) {
    case "CREATED":
      return { verb: "created the issue" };
    case "STATUS_CHANGED":
      return {
        verb: "changed the status",
        from: log.oldValue ? prettifyStatusName(log.oldValue) : null,
        to: prettifyStatusName(log.newValue),
      };
    case "PRIORITY_CHANGED":
      return {
        verb: "changed the priority",
        from: log.oldValue ? (PRIORITY_NAMES[log.oldValue] ?? log.oldValue) : null,
        to: log.newValue ? (PRIORITY_NAMES[log.newValue] ?? log.newValue) : null,
      };
    case "ASSIGNMENT_CHANGED":
      return { verb: "changed the assignee", from: log.oldValue ? person(log.oldValue) : null, to: person(log.newValue) };
    case "COMMENTED":
      return { verb: log.newValue?.startsWith("Edited:") ? "edited a comment" : "commented" };
    case "MENTIONED":
      return { verb: `mentioned ${log.newValue ?? "someone"}${log.field === "description" ? " in the description" : ""}` };
    case "LABEL_ADDED":
      return { verb: "added the label", to: log.newValue };
    case "LABEL_REMOVED":
      return { verb: "removed the label", to: log.newValue };
    case "COMPONENT_ADDED":
      return { verb: "added the component", to: log.newValue };
    case "COMPONENT_REMOVED":
      return { verb: "removed the component", to: log.newValue };
    case "LINKED":
      return { verb: "added a link", to: log.newValue };
    case "UNLINKED":
      return { verb: "removed a link", to: log.newValue };
    case "ATTACHED":
      return { verb: "attached", to: log.newValue };
    case "LOGGED_WORK":
      return { verb: "logged work", to: log.newValue };
    default: {
      const verb = log.action.toLowerCase().replace(/_/g, " ");
      return { verb: log.field ? `${verb} (${log.field})` : verb, from: log.oldValue, to: log.newValue };
    }
  }
}

// ---- Single-key shortcuts ------------------------------------------------------

export type IssueShortcut = "assignee" | "status" | "priority" | "assign-to-me";

const SHORTCUT_KEYS: Record<string, IssueShortcut> = {
  a: "assignee",
  s: "status",
  p: "priority",
  i: "assign-to-me",
};

/**
 * The issue shortcut a key press asks for, if any. Not while typing, not with
 * a modifier, and not as the second key of a "g" sequence (g i, g s and g p
 * go to pages), which the caller reports as `afterG`.
 */
export function issueShortcutFor(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; defaultPrevented?: boolean },
  { typing, afterG }: { typing: boolean; afterG: boolean }
): IssueShortcut | null {
  if (typing || afterG || e.defaultPrevented) return null;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  return SHORTCUT_KEYS[e.key] ?? null;
}
