"use client";

import {
  parseRecentIssues,
  pushRecentIssue,
  recentIssuesStorageKey,
  type RecentIssue,
} from "@/lib/shell";

/** Fired on window after the list changes, so Home and search can refresh. */
export const RECENT_ISSUES_EVENT = "tamam:recent-issues";

/**
 * Recently opened issues live in this browser only: they are a convenience,
 * not a record, and nothing about them needs to reach the server. Storage can
 * be unavailable (private windows, blocked site data), so every access is
 * guarded and a failure just means an empty list.
 */
export function readRecentIssues(userId: string | null | undefined): RecentIssue[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    return parseRecentIssues(window.localStorage.getItem(recentIssuesStorageKey(userId)));
  } catch {
    return [];
  }
}

export function recordRecentIssue(
  userId: string | null | undefined,
  issue: { key: string; title: string; projectKey: string }
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const next = pushRecentIssue(readRecentIssues(userId), { ...issue, viewedAt: Date.now() });
    window.localStorage.setItem(recentIssuesStorageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_ISSUES_EVENT));
  } catch {
    // Storage full or blocked: nothing to remember, nothing to break.
  }
}
