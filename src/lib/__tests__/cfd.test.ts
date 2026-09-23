import { describe, expect, it } from "vitest";
import { computeCumulativeFlow, CFDCategory, CFDIssue } from "../cfd";
import { StatusChangeEvent } from "../burndown";

const categories: CFDCategory[] = [
  { key: "DONE", label: "Done", color: "#36B37E", statuses: ["DONE", "CLOSED"] },
  { key: "IN_PROGRESS", label: "In Progress", color: "#0052CC", statuses: ["IN_PROGRESS", "IN_REVIEW"] },
  { key: "TODO", label: "To Do", color: "#8993A4", statuses: ["TODO", "BACKLOG"] },
];

describe("computeCumulativeFlow", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-05T00:00:00Z");

  it("classifies issues correctly based on initial status when no changes exist", () => {
    const issues: CFDIssue[] = [
      { id: "1", createdAt: new Date("2025-12-30T00:00:00Z"), status: "TODO", storyPoints: 3 },
      { id: "2", createdAt: new Date("2025-12-30T00:00:00Z"), status: "IN_PROGRESS", storyPoints: 5 },
      { id: "3", createdAt: new Date("2025-12-30T00:00:00Z"), status: "DONE", storyPoints: 2 },
    ];

    const result = computeCumulativeFlow(issues, [], categories, start, end, end);

    expect(result.points.length).toBe(5);
    const day1 = result.points[0];
    expect(day1.counts.TODO).toBe(1);
    expect(day1.counts.IN_PROGRESS).toBe(1);
    expect(day1.counts.DONE).toBe(1);
    expect(day1.totalIssues).toBe(3);

    expect(day1.points.TODO).toBe(3);
    expect(day1.points.IN_PROGRESS).toBe(5);
    expect(day1.points.DONE).toBe(2);
    expect(day1.totalPoints).toBe(10);
  });

  it("also totals each status separately, so every status can get its own band", () => {
    const issues: CFDIssue[] = [
      { id: "1", createdAt: new Date("2025-12-30T00:00:00Z"), status: "IN_PROGRESS", storyPoints: 5 },
      { id: "2", createdAt: new Date("2025-12-30T00:00:00Z"), status: "IN_REVIEW", storyPoints: 3 },
      { id: "3", createdAt: new Date("2025-12-30T00:00:00Z"), status: "IN_REVIEW", storyPoints: 1 },
    ];

    const day1 = computeCumulativeFlow(issues, [], categories, start, end, end).points[0];

    expect(day1.counts.IN_PROGRESS).toBe(3);
    expect(day1.byStatus).toEqual({
      IN_PROGRESS: { count: 1, points: 5 },
      IN_REVIEW: { count: 2, points: 4 },
    });
  });

  it("reconstructs status movements across time", () => {
    const issues: CFDIssue[] = [
      { id: "1", createdAt: new Date("2025-12-30T00:00:00Z"), status: "DONE", storyPoints: 4 },
    ];

    // Issue was TODO, moved to IN_PROGRESS on Jan 2, moved to DONE on Jan 4
    const changes: StatusChangeEvent[] = [
      {
        issueId: "1",
        oldValue: "TODO",
        newValue: "IN_PROGRESS",
        createdAt: new Date("2026-01-02T12:00:00Z"),
      },
      {
        issueId: "1",
        oldValue: "IN_PROGRESS",
        newValue: "DONE",
        createdAt: new Date("2026-01-04T12:00:00Z"),
      },
    ];

    const result = computeCumulativeFlow(issues, changes, categories, start, end, end);
    const p = result.points;

    // Jan 1: TODO
    expect(p[0].counts.TODO).toBe(1);
    expect(p[0].counts.IN_PROGRESS).toBe(0);
    expect(p[0].counts.DONE).toBe(0);

    // Jan 2: IN_PROGRESS
    expect(p[1].counts.TODO).toBe(0);
    expect(p[1].counts.IN_PROGRESS).toBe(1);
    expect(p[1].counts.DONE).toBe(0);

    // Jan 3: IN_PROGRESS
    expect(p[2].counts.TODO).toBe(0);
    expect(p[2].counts.IN_PROGRESS).toBe(1);
    expect(p[2].counts.DONE).toBe(0);

    // Jan 4: DONE
    expect(p[3].counts.TODO).toBe(0);
    expect(p[3].counts.IN_PROGRESS).toBe(0);
    expect(p[3].counts.DONE).toBe(1);
  });

  it("ignores issues before their creation date", () => {
    const issues: CFDIssue[] = [
      { id: "1", createdAt: new Date("2026-01-03T10:00:00Z"), status: "TODO", storyPoints: 2 },
    ];

    const result = computeCumulativeFlow(issues, [], categories, start, end, end);
    const p = result.points;

    // Jan 1 & 2: 0 total issues
    expect(p[0].totalIssues).toBe(0);
    expect(p[1].totalIssues).toBe(0);

    // Jan 3: 1 total issue
    expect(p[2].totalIssues).toBe(1);
    expect(p[2].counts.TODO).toBe(1);
  });

  it("calculates WIP and throughput metrics accurately", () => {
    const issues: CFDIssue[] = [
      { id: "1", createdAt: new Date("2025-12-01T00:00:00Z"), status: "IN_PROGRESS", storyPoints: 5 },
      { id: "2", createdAt: new Date("2025-12-01T00:00:00Z"), status: "DONE", storyPoints: 3 },
    ];

    const changes: StatusChangeEvent[] = [
      {
        issueId: "2",
        oldValue: "IN_PROGRESS",
        newValue: "DONE",
        createdAt: new Date("2026-01-03T10:00:00Z"),
      },
    ];

    const result = computeCumulativeFlow(issues, changes, categories, start, end, end);

    expect(result.metrics.currentWipIssues).toBe(1);
    expect(result.metrics.currentWipPoints).toBe(5);
    expect(result.metrics.totalCompletedInWindow).toBe(1);
    expect(result.metrics.throughputPerWeek).toBeGreaterThan(0);
    expect(result.metrics.avgLeadTimeDays).toBeGreaterThan(0);
  });
});
