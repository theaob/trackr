import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { computeBurndown, statusAsOf, type StatusChangeEvent } from "@/lib/burndown";

const DONE = ["DONE"];

describe("statusAsOf", () => {
  it("returns the current status when there is no history", () => {
    const issue = { id: "1", storyPoints: 3, status: "IN_PROGRESS" };
    expect(statusAsOf(issue, [], new Date("2026-01-05"))).toBe("IN_PROGRESS");
  });

  it("returns the pre-change status for a moment before the first change", () => {
    const issue = { id: "1", storyPoints: 3, status: "DONE" };
    const changes: StatusChangeEvent[] = [
      { issueId: "1", oldValue: "TODO", newValue: "IN_PROGRESS", createdAt: new Date("2026-01-03") },
    ];
    expect(statusAsOf(issue, changes, new Date("2026-01-01"))).toBe("TODO");
  });

  it("walks forward through multiple changes to find the status at a later moment", () => {
    const issue = { id: "1", storyPoints: 3, status: "DONE" };
    const changes: StatusChangeEvent[] = [
      { issueId: "1", oldValue: "TODO", newValue: "IN_PROGRESS", createdAt: new Date("2026-01-02") },
      { issueId: "1", oldValue: "IN_PROGRESS", newValue: "DONE", createdAt: new Date("2026-01-05") },
    ];
    expect(statusAsOf(issue, changes, new Date("2026-01-03"))).toBe("IN_PROGRESS");
    expect(statusAsOf(issue, changes, new Date("2026-01-06"))).toBe("DONE");
    expect(statusAsOf(issue, changes, new Date("2026-01-05"))).toBe("DONE");
  });
});

describe("computeBurndown", () => {
  const start = new Date("2026-01-01");
  const end = new Date("2026-01-05");

  it("starts the ideal line at the full point total and ends at zero", () => {
    const issues = [
      { id: "1", storyPoints: 5, status: "TODO" },
      { id: "2", storyPoints: 3, status: "TODO" },
    ];
    const series = computeBurndown(issues, [], DONE, start, end, end);
    expect(series[0].ideal).toBe(8);
    expect(series[series.length - 1].ideal).toBe(0);
  });

  it("counts an issue as remaining until its status crosses into a done category", () => {
    const issues = [{ id: "1", storyPoints: 5, status: "DONE" }];
    const changes: StatusChangeEvent[] = [
      { issueId: "1", oldValue: "TODO", newValue: "DONE", createdAt: new Date("2026-01-03") },
    ];
    const series = computeBurndown(issues, changes, DONE, start, end, end);
    const byDate = (d: string) => series.find((p) => format(p.date, "yyyy-MM-dd") === d)!;

    expect(byDate("2026-01-02").remaining).toBe(5);
    expect(byDate("2026-01-03").remaining).toBe(0);
    expect(byDate("2026-01-04").remaining).toBe(0);
  });

  it("leaves remaining null for days after today", () => {
    const issues = [{ id: "1", storyPoints: 5, status: "TODO" }];
    const today = new Date("2026-01-03");
    const series = computeBurndown(issues, [], DONE, start, end, today);
    const byDate = (d: string) => series.find((p) => format(p.date, "yyyy-MM-dd") === d)!;

    expect(byDate("2026-01-03").remaining).toBe(5);
    expect(byDate("2026-01-04").remaining).toBeNull();
    expect(byDate("2026-01-05").remaining).toBeNull();
  });

  it("ignores story-points-less issues without throwing", () => {
    const issues = [{ id: "1", storyPoints: null, status: "TODO" }];
    const series = computeBurndown(issues, [], DONE, start, end, end);
    expect(series.every((p) => p.remaining === 0 || p.remaining === null)).toBe(true);
  });

  it("ensures at least 2 points even if startDate and endDate are the same day", () => {
    const issues = [{ id: "1", storyPoints: 5, status: "TODO" }];
    const sameDay = new Date("2026-01-01");
    const series = computeBurndown(issues, [], DONE, sameDay, sameDay, sameDay);
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series[0].ideal).toBe(5);
    expect(series[1].ideal).toBe(0);
  });

  it("correctly plots Day 1 remaining work on the first day of an active sprint", () => {
    const issues = [
      { id: "1", storyPoints: 5, status: "IN_PROGRESS" },
      { id: "2", storyPoints: 3, status: "DONE" },
    ];
    const sprintStart = new Date("2026-01-01");
    const sprintEnd = new Date("2026-01-14");
    const day1 = new Date("2026-01-01");

    const series = computeBurndown(issues, [], DONE, sprintStart, sprintEnd, day1);
    expect(series.length).toBe(14);
    // On Day 1, point 0 has remaining work (issue 1 is 5 points, issue 2 is DONE)
    expect(series[0].remaining).toBe(5);
    // Future days have null remaining
    expect(series[1].remaining).toBeNull();
    expect(series[series.length - 1].remaining).toBeNull();
  });

  it("calculates burnup metrics (scope, completed, idealCompleted) correctly", () => {
    const issues = [
      { id: "1", storyPoints: 5, status: "TODO" },
      { id: "2", storyPoints: 3, status: "DONE" },
    ];
    const series = computeBurndown(issues, [], DONE, start, end, end);

    // Total scope should be 8
    expect(series[0].scope).toBe(8);
    expect(series[series.length - 1].scope).toBe(8);

    // Completed should be 3
    expect(series[0].completed).toBe(3);
    expect(series[series.length - 1].completed).toBe(3);

    // Ideal completed starts at 0 and ends at total scope (8)
    expect(series[0].idealCompleted).toBe(0);
    expect(series[series.length - 1].idealCompleted).toBe(8);
  });
});
