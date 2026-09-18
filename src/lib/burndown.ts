import { eachDayOfInterval, endOfDay, startOfDay } from "date-fns";

export interface StatusChangeEvent {
  issueId: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

export interface BurndownIssue {
  id: string;
  storyPoints: number | null;
  /** Current status -- the fallback when an issue has no logged status change. */
  status: string;
}

export interface BurndownPoint {
  date: Date;
  ideal: number;
  /** Null for a day after `today`: the sprint hasn't lived that far yet. */
  remaining: number | null;
}

/**
 * The status an issue was actually in at `at`, reconstructed from its ordered
 * (ascending) STATUS_CHANGED history. Before the first logged change, the
 * issue was in that change's oldValue; after the last one at-or-before `at`,
 * it's that change's newValue. No history at all means the status hasn't
 * moved since creation, so the issue's current status stands for every `at`.
 */
export function statusAsOf(
  issue: BurndownIssue,
  changesAscending: StatusChangeEvent[],
  at: Date
): string {
  if (changesAscending.length === 0) return issue.status;

  const atTime = at.getTime();
  if (atTime < changesAscending[0].createdAt.getTime()) {
    return changesAscending[0].oldValue ?? issue.status;
  }

  let status = changesAscending[0].oldValue ?? issue.status;
  for (const change of changesAscending) {
    if (change.createdAt.getTime() > atTime) break;
    status = change.newValue ?? status;
  }
  return status;
}

/**
 * A day-by-day burndown series from `startDate` through `endDate` inclusive.
 * `ideal` is a straight line from the sprint's total points to zero. `remaining`
 * is the actual points left as of the end of each day, computed by replaying
 * each issue's status history -- null once a day is later than `today`, since
 * the sprint hasn't reached it yet.
 */
export function computeBurndown(
  issues: BurndownIssue[],
  statusChanges: StatusChangeEvent[],
  doneStatusNames: string[],
  startDate: Date,
  endDate: Date,
  today: Date = new Date()
): BurndownPoint[] {
  const totalPoints = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const changesByIssue = new Map<string, StatusChangeEvent[]>();
  for (const change of statusChanges) {
    const list = changesByIssue.get(change.issueId);
    if (list) list.push(change);
    else changesByIssue.set(change.issueId, [change]);
  }
  changesByIssue.forEach((list) => {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  });

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const effectiveEnd = end.getTime() <= start.getTime()
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : end;
  const days = eachDayOfInterval({ start, end: effectiveEnd });
  const lastIndex = Math.max(1, days.length - 1);
  const todayEnd = endOfDay(today);
  const doneSet = new Set(doneStatusNames);

  return days.map((day, index) => {
    const ideal = Math.max(0, totalPoints * (1 - index / lastIndex));

    if (day.getTime() > todayEnd.getTime()) {
      return { date: day, ideal, remaining: null };
    }

    const dayEnd = endOfDay(day);
    const remaining = issues.reduce((sum, issue) => {
      const status = statusAsOf(issue, changesByIssue.get(issue.id) ?? [], dayEnd);
      return doneSet.has(status) ? sum : sum + (issue.storyPoints ?? 0);
    }, 0);

    return { date: day, ideal, remaining };
  });
}
