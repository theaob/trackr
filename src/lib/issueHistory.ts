import type { Issue } from "@/types";

/**
 * An issue arrives with only its latest comments and activity (see
 * RECENT_HISTORY_INCLUDE in actions/issues.ts) plus a count of each. These
 * keep the count honest as the lists change on the client.
 */

export type HistoryKind = "comments" | "activity";

function listOf(issue: Issue, kind: HistoryKind): any[] {
  return (kind === "comments" ? issue.comments : issue.activityLogs) ?? [];
}

/** How many exist in total, never fewer than are loaded. */
export function historyTotal(issue: Issue, kind: HistoryKind): number {
  const counted = kind === "comments" ? issue._count?.comments : issue._count?.activityLogs;
  return Math.max(counted ?? 0, listOf(issue, kind).length);
}

/** How many older entries haven't been loaded yet. */
export function historyRemaining(issue: Issue, kind: HistoryKind): number {
  return Math.max(0, historyTotal(issue, kind) - listOf(issue, kind).length);
}

/** The issue with its comment count moved by `delta` (after adding or deleting one). */
export function withCommentCountChange<T extends Issue>(issue: T, delta: number): T {
  if (!issue._count) return issue;
  return { ...issue, _count: { ...issue._count, comments: Math.max(0, issue._count.comments + delta) } };
}

/** The issue with an older page appended to one of its lists. */
export function withOlderHistory<T extends Issue>(issue: T, kind: HistoryKind, older: any[]): T {
  const existing = listOf(issue, kind);
  const seen = new Set(existing.map((e) => e.id));
  const merged = [...existing, ...older.filter((e) => !seen.has(e.id))];
  return kind === "comments" ? { ...issue, comments: merged } : { ...issue, activityLogs: merged };
}

/** The id to page from: the oldest entry loaded, ignoring optimistic placeholders. */
export function oldestLoadedId(issue: Issue, kind: HistoryKind): string | null {
  const loaded = listOf(issue, kind).filter((e) => !String(e.id).startsWith("temp-"));
  return loaded.length > 0 ? loaded[loaded.length - 1].id : null;
}
