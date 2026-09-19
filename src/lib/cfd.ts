import { eachDayOfInterval, endOfDay, startOfDay, differenceInDays } from "date-fns";
import { statusAsOf, StatusChangeEvent } from "./burndown";

export interface CFDIssue {
  id: string;
  createdAt: Date;
  status: string;
  storyPoints: number | null;
}

export interface CFDCategory {
  key: "DONE" | "IN_PROGRESS" | "TODO";
  label: string;
  color: string;
  statuses: string[];
}

export interface CFDDataPoint {
  date: Date;
  dateStr: string;
  counts: Record<"DONE" | "IN_PROGRESS" | "TODO", number>;
  points: Record<"DONE" | "IN_PROGRESS" | "TODO", number>;
  totalIssues: number;
  totalPoints: number;
}

export interface CFDMetrics {
  currentWipIssues: number;
  currentWipPoints: number;
  throughputPerWeek: number;
  avgLeadTimeDays: number | null;
  totalCompletedInWindow: number;
}

export interface CFDResult {
  points: CFDDataPoint[];
  categories: CFDCategory[];
  metrics: CFDMetrics;
}

export function computeCumulativeFlow(
  issues: CFDIssue[],
  statusChanges: StatusChangeEvent[],
  categories: CFDCategory[],
  startDate: Date,
  endDate: Date,
  today: Date = new Date()
): CFDResult {
  const changesByIssue = new Map<string, StatusChangeEvent[]>();
  for (const change of statusChanges) {
    const list = changesByIssue.get(change.issueId);
    if (list) list.push(change);
    else changesByIssue.set(change.issueId, [change]);
  }
  changesByIssue.forEach((list) => {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  });

  // Map each status name to its category key ("DONE", "IN_PROGRESS", "TODO")
  const statusToCategory = new Map<string, "DONE" | "IN_PROGRESS" | "TODO">();
  for (const cat of categories) {
    for (const st of cat.statuses) {
      statusToCategory.set(st, cat.key);
    }
  }

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const effectiveEnd = end.getTime() <= start.getTime()
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : end;

  const days = eachDayOfInterval({ start, end: effectiveEnd });
  const todayEnd = endOfDay(today);

  // Filter out days in the future beyond today
  const activeDays = days.filter((d) => d.getTime() <= todayEnd.getTime());

  const points: CFDDataPoint[] = activeDays.map((day) => {
    const dayEnd = endOfDay(day);
    const counts = { DONE: 0, IN_PROGRESS: 0, TODO: 0 };
    const pointsMap = { DONE: 0, IN_PROGRESS: 0, TODO: 0 };

    for (const issue of issues) {
      // If the issue was created after this day, it's not yet in the flow
      if (issue.createdAt.getTime() > dayEnd.getTime()) {
        continue;
      }

      const st = statusAsOf(issue, changesByIssue.get(issue.id) ?? [], dayEnd);
      const cat = statusToCategory.get(st) ?? "TODO";
      const pts = issue.storyPoints ?? 0;

      counts[cat]++;
      pointsMap[cat] += pts;
    }

    const totalIssues = counts.DONE + counts.IN_PROGRESS + counts.TODO;
    const totalPoints = pointsMap.DONE + pointsMap.IN_PROGRESS + pointsMap.TODO;

    return {
      date: day,
      dateStr: day.toISOString().slice(0, 10),
      counts,
      points: pointsMap,
      totalIssues,
      totalPoints,
    };
  });

  // Calculate flow metrics
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  const currentWipIssues = lastPoint ? lastPoint.counts.IN_PROGRESS : 0;
  const currentWipPoints = lastPoint ? lastPoint.points.IN_PROGRESS : 0;

  const completedDelta = (lastPoint?.counts.DONE ?? 0) - (firstPoint?.counts.DONE ?? 0);
  const totalCompletedInWindow = Math.max(0, completedDelta);
  const daysSpan = Math.max(1, days.length);
  const throughputPerWeek = parseFloat(((totalCompletedInWindow / daysSpan) * 7).toFixed(1));

  // Compute average lead time for issues completed during the window
  const doneStatuses = new Set(
    categories.find((c) => c.key === "DONE")?.statuses ?? []
  );

  const leadTimes: number[] = [];
  for (const issue of issues) {
    const issueChanges = changesByIssue.get(issue.id) ?? [];
    // Find when the issue first crossed into DONE
    const doneChange = issueChanges.find(
      (c) => doneStatuses.has(c.newValue ?? "") && c.createdAt >= start && c.createdAt <= todayEnd
    );
    if (doneChange) {
      const daysTaken = Math.max(0.5, differenceInDays(doneChange.createdAt, issue.createdAt));
      leadTimes.push(daysTaken);
    }
  }

  const avgLeadTimeDays =
    leadTimes.length > 0
      ? parseFloat((leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length).toFixed(1))
      : null;

  return {
    points,
    categories,
    metrics: {
      currentWipIssues,
      currentWipPoints,
      throughputPerWeek,
      avgLeadTimeDays,
      totalCompletedInWindow,
    },
  };
}
