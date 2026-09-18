"use server";

import prisma from "@/lib/db";
import { requireProjectAccess, projectIdForSprint } from "@/lib/auth/guards";
import { getDoneStatusNames, getWorkflowStatuses } from "@/lib/workflow";
import { computeBurndown } from "@/lib/burndown";

/** Sprints worth showing in the report selector: no data exists for one that hasn't started. */
export async function getReportableSprints(projectId: string) {
  try {
    await requireProjectAccess(projectId);
    return await prisma.sprint.findMany({
      where: { projectId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: [{ startDate: "desc" }],
    });
  } catch (error) {
    console.error("Failed to fetch reportable sprints:", error);
    return [];
  }
}

export async function getSprintReport(sprintId: string) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    await requireProjectAccess(projectId);

    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) return null;

    const issues = await prisma.issue.findMany({
      where: { sprintId },
      select: { id: true, key: true, title: true, storyPoints: true, status: true, createdAt: true },
    });

    const issueIds = issues.map((i) => i.id);
    const statusChanges = issueIds.length
      ? await prisma.activityLog.findMany({
          where: { issueId: { in: issueIds }, action: "STATUS_CHANGED" },
          select: { issueId: true, oldValue: true, newValue: true, createdAt: true },
        })
      : [];

    const [doneNames, statuses] = await Promise.all([
      getDoneStatusNames(projectId),
      getWorkflowStatuses(projectId),
    ]);

    const hasStoryPoints = issues.some((i) => (i.storyPoints ?? 0) > 0);
    const isIssueCount = !hasStoryPoints && issues.length > 0;

    const effectiveIssues = isIssueCount
      ? issues.map((i) => ({ ...i, storyPoints: 1 }))
      : issues;

    const totalPoints = effectiveIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
    const doneIssues = effectiveIssues.filter((i) => doneNames.includes(i.status));
    const completedPoints = isIssueCount
      ? doneIssues.length
      : doneIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

    const start = sprint.startDate ?? sprint.createdAt;
    const end =
      sprint.endDate && sprint.endDate.getTime() > start.getTime()
        ? sprint.endDate
        : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    const burndown = computeBurndown(effectiveIssues, statusChanges, doneNames, start, end);

    const statusBreakdown = statuses
      .map((s) => {
        const matching = issues.filter((i) => i.status === s.name);
        return {
          name: s.name,
          color: s.color,
          count: matching.length,
          points: matching.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
        };
      })
      .filter((s) => s.count > 0);

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        goal: sprint.goal,
      },
      totalPoints,
      completedPoints,
      totalIssues: issues.length,
      completedIssues: doneIssues.length,
      isIssueCount,
      burndown,
      statusBreakdown,
    };
  } catch (error) {
    console.error("Failed to build sprint report:", error);
    return null;
  }
}

/** Completed story points per completed sprint, oldest first, for the velocity chart. */
export async function getProjectVelocity(projectId: string, limit = 8) {
  try {
    await requireProjectAccess(projectId);

    const sprints = await prisma.sprint.findMany({
      where: { projectId, status: "COMPLETED" },
      orderBy: { endDate: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        endDate: true,
        issues: { select: { storyPoints: true } },
      },
    });

    return sprints
      .map((s) => ({
        id: s.id,
        name: s.name,
        endDate: s.endDate,
        points: s.issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
        issueCount: s.issues.length,
      }))
      .reverse();
  } catch (error) {
    console.error("Failed to fetch project velocity:", error);
    return [];
  }
}
