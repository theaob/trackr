"use server";

import prisma from "@/lib/db";
import { requireProjectAccess, projectIdForSprint } from "@/lib/auth/guards";
import { getDoneStatusNames, getWorkflowStatuses } from "@/lib/workflow";
import { computeBurndown } from "@/lib/burndown";
import { computeCumulativeFlow, CFDCategory, CFDStatus } from "@/lib/cfd";
import { CATEGORY_COLORS, UNKNOWN_STATUS_COLOR, stackingOrder } from "@/lib/statusColors";

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

export interface VelocitySprintItem {
  id: string;
  name: string;
  status: string;
  endDate: Date | null;
  points: number; // backward compatibility (completed points)
  completedPoints: number;
  committedPoints: number;
  issueCount: number; // backward compatibility (completed count)
  completedIssues: number;
  committedIssues: number;
  reliabilityPct: number;
}

export interface ProjectVelocityReport {
  sprints: VelocitySprintItem[];
  averageCompletedPoints: number;
  averageCommittedPoints: number;
  averageReliabilityPct: number;
}

/** Velocity data per sprint with side-by-side committed vs completed metrics. */
export async function getProjectVelocity(projectId: string, limit = 8): Promise<VelocitySprintItem[]> {
  try {
    await requireProjectAccess(projectId);

    const [doneNames, sprints] = await Promise.all([
      getDoneStatusNames(projectId),
      prisma.sprint.findMany({
        where: { projectId, status: { in: ["COMPLETED", "ACTIVE"] } },
        orderBy: { endDate: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          issues: {
            select: {
              id: true,
              storyPoints: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const sprintItems: VelocitySprintItem[] = sprints.map((s) => {
      const allIssues = s.issues;
      const doneIssues = allIssues.filter((i) => doneNames.includes(i.status));

      const completedPoints = doneIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
      const totalPoints = allIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

      // For completed sprints, if issues were moved out, completedPoints was the baseline.
      const committedPoints = Math.max(totalPoints, completedPoints);
      const committedIssues = Math.max(allIssues.length, doneIssues.length);
      const completedIssues = doneIssues.length;

      const reliabilityPct =
        committedPoints > 0
          ? Math.min(100, Math.round((completedPoints / committedPoints) * 100))
          : completedIssues > 0
          ? 100
          : 0;

      return {
        id: s.id,
        name: s.name,
        status: s.status,
        endDate: s.endDate,
        points: completedPoints,
        completedPoints,
        committedPoints,
        issueCount: completedIssues,
        completedIssues,
        committedIssues,
        reliabilityPct,
      };
    });

    return sprintItems.reverse();
  } catch (error) {
    console.error("Failed to fetch project velocity:", error);
    return [];
  }
}

/** Cumulative Flow Diagram data for Kanban and Scrum projects over a day window. */
export async function getCumulativeFlowReport(projectId: string, days = 30) {
  try {
    await requireProjectAccess(projectId);

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const [workflowStatuses, issues] = await Promise.all([
      getWorkflowStatuses(projectId),
      prisma.issue.findMany({
        where: { projectId },
        select: { id: true, createdAt: true, status: true, storyPoints: true },
      }),
    ]);

    const issueIds = issues.map((i) => i.id);
    const statusChanges = issueIds.length
      ? await prisma.activityLog.findMany({
          where: { issueId: { in: issueIds }, action: "STATUS_CHANGED" },
          select: { issueId: true, oldValue: true, newValue: true, createdAt: true },
        })
      : [];

    const categories: CFDCategory[] = [
      {
        key: "DONE",
        label: "Done",
        color: CATEGORY_COLORS.DONE,
        statuses: workflowStatuses.filter((s) => s.category === "DONE").map((s) => s.name),
      },
      {
        key: "IN_PROGRESS",
        label: "In Progress",
        color: CATEGORY_COLORS.IN_PROGRESS,
        statuses: workflowStatuses.filter((s) => s.category === "IN_PROGRESS").map((s) => s.name),
      },
      {
        key: "TODO",
        label: "To Do / Backlog",
        color: CATEGORY_COLORS.TODO,
        statuses: workflowStatuses.filter((s) => s.category === "TODO").map((s) => s.name),
      },
    ];

    const flow = computeCumulativeFlow(issues, statusChanges, categories, startDate, endDate);

    // One band per status, in its workflow color. An issue can still carry a
    // status that has since been removed; those go on top in neutral gray.
    const statuses: CFDStatus[] = stackingOrder(workflowStatuses).map((s) => ({
      name: s.name,
      color: s.color,
      category: s.category as CFDStatus["category"],
    }));
    const known = new Set(statuses.map((s) => s.name));
    for (const point of flow.points) {
      for (const name of Object.keys(point.byStatus)) {
        if (known.has(name)) continue;
        known.add(name);
        statuses.push({ name, color: UNKNOWN_STATUS_COLOR, category: "TODO" });
      }
    }

    return { ...flow, statuses };
  } catch (error) {
    console.error("Failed to build cumulative flow report:", error);
    return null;
  }
}

export interface DistributionEntry {
  name: string;
  color: string;
  category?: string;
  count: number;
  points: number;
}

export interface AssigneeDistributionEntry {
  id: string;
  name: string;
  avatarUrl: string | null;
  count: number;
  points: number;
  completedCount: number;
  completedPoints: number;
}

export interface ProjectDistributionReport {
  totalIssues: number;
  totalPoints: number;
  byStatus: DistributionEntry[];
  byPriority: DistributionEntry[];
  byType: DistributionEntry[];
  byAssignee: AssigneeDistributionEntry[];
}

/** Multi-dimensional issue distribution across status, priority, type, and assignee. */
export async function getProjectDistribution(
  projectId: string,
  sprintId?: string | null
): Promise<ProjectDistributionReport | null> {
  try {
    await requireProjectAccess(projectId);

    const where: any = { projectId };
    if (sprintId && sprintId !== "ALL") {
      where.sprintId = sprintId;
    }

    const [workflowStatuses, issues, users] = await Promise.all([
      getWorkflowStatuses(projectId),
      prisma.issue.findMany({
        where,
        select: {
          id: true,
          status: true,
          priority: true,
          type: true,
          storyPoints: true,
          assigneeId: true,
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.user.findMany({
        where: { projectMembers: { some: { projectId } } },
        select: { id: true, name: true, avatarUrl: true },
      }),
    ]);

    const doneNames = new Set(
      workflowStatuses.filter((s) => s.category === "DONE").map((s) => s.name)
    );

    // 1. By Status
    const byStatus = workflowStatuses.map((s) => {
      const matching = issues.filter((i) => i.status === s.name);
      return {
        name: s.name,
        category: s.category,
        color: s.color,
        count: matching.length,
        points: matching.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      };
    });

    // 2. By Priority
    const priorityColors: Record<string, string> = {
      HIGHEST: "#FF5630",
      HIGH: "#FF7452",
      MEDIUM: "#FFAB00",
      LOW: "#36B37E",
      LOWEST: "#0065FF",
    };
    const priorityOrder = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];
    const byPriority = priorityOrder.map((p) => {
      const matching = issues.filter((i) => i.priority === p);
      return {
        name: p,
        color: priorityColors[p] || "#8993A4",
        count: matching.length,
        points: matching.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      };
    });

    // 3. By Issue Type
    const typeColors: Record<string, string> = {
      STORY: "#36B37E",
      BUG: "#E5493A",
      TASK: "#4BADE8",
      EPIC: "#904EE2",
    };
    const typeOrder = ["STORY", "BUG", "TASK", "EPIC"];
    const byType = typeOrder.map((t) => {
      const matching = issues.filter((i) => i.type === t);
      return {
        name: t,
        color: typeColors[t] || "#8993A4",
        count: matching.length,
        points: matching.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      };
    });

    // 4. By Assignee
    const assigneeMap = new Map<string, AssigneeDistributionEntry>();
    assigneeMap.set("unassigned", {
      id: "unassigned",
      name: "Unassigned",
      avatarUrl: null,
      count: 0,
      points: 0,
      completedCount: 0,
      completedPoints: 0,
    });

    for (const u of users) {
      assigneeMap.set(u.id, {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        count: 0,
        points: 0,
        completedCount: 0,
        completedPoints: 0,
      });
    }

    for (const i of issues) {
      const key = i.assigneeId || "unassigned";
      let entry = assigneeMap.get(key);
      if (!entry) {
        entry = {
          id: key,
          name: i.assignee?.name || "Unknown",
          avatarUrl: i.assignee?.avatarUrl || null,
          count: 0,
          points: 0,
          completedCount: 0,
          completedPoints: 0,
        };
        assigneeMap.set(key, entry);
      }
      const pts = i.storyPoints ?? 0;
      entry.count++;
      entry.points += pts;
      if (doneNames.has(i.status)) {
        entry.completedCount++;
        entry.completedPoints += pts;
      }
    }

    const byAssignee = Array.from(assigneeMap.values())
      .filter((a) => a.count > 0 || a.id !== "unassigned")
      .sort((a, b) => b.count - a.count);

    return {
      totalIssues: issues.length,
      totalPoints: issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      byStatus,
      byPriority,
      byType,
      byAssignee,
    };
  } catch (error) {
    console.error("Failed to build distribution report:", error);
    return null;
  }
}

export interface EpicProgressItem {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  todoPoints: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  completionPct: number;
  /** Child issues per status, in workflow colors and stacking order; empty statuses omitted. */
  segments: { name: string; color: string; issues: number; points: number }[];
}

/** Epic progress tracking report showing child issue status breakdown. */
export async function getEpicProgressReport(projectId: string): Promise<EpicProgressItem[]> {
  try {
    await requireProjectAccess(projectId);

    const [workflowStatuses, epics] = await Promise.all([
      getWorkflowStatuses(projectId),
      prisma.issue.findMany({
        where: { projectId, type: "EPIC" },
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          children: {
            select: {
              id: true,
              key: true,
              title: true,
              status: true,
              storyPoints: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
    ]);

    const doneNames = new Set(
      workflowStatuses.filter((s) => s.category === "DONE").map((s) => s.name)
    );
    const inProgressNames = new Set(
      workflowStatuses.filter((s) => s.category === "IN_PROGRESS").map((s) => s.name)
    );

    return epics.map((epic) => {
      const children = epic.children || [];
      const totalPoints = children.reduce((sum, c) => sum + (c.storyPoints ?? 0), 0);
      const completedPoints = children
        .filter((c) => doneNames.has(c.status))
        .reduce((sum, c) => sum + (c.storyPoints ?? 0), 0);
      const inProgressPoints = children
        .filter((c) => inProgressNames.has(c.status))
        .reduce((sum, c) => sum + (c.storyPoints ?? 0), 0);
      const todoPoints = Math.max(0, totalPoints - completedPoints - inProgressPoints);

      const totalIssues = children.length;
      const completedIssues = children.filter((c) => doneNames.has(c.status)).length;
      const inProgressIssues = children.filter((c) => inProgressNames.has(c.status)).length;
      const todoIssues = totalIssues - completedIssues - inProgressIssues;

      const completionPct =
        totalPoints > 0
          ? Math.round((completedPoints / totalPoints) * 100)
          : totalIssues > 0
          ? Math.round((completedIssues / totalIssues) * 100)
          : 0;

      const ordered = stackingOrder(workflowStatuses);
      const segments = ordered.map((s) => ({ name: s.name, color: s.color, issues: 0, points: 0 }));
      for (const child of children) {
        let segment = segments.find((seg) => seg.name === child.status);
        if (!segment) {
          segment = { name: child.status, color: UNKNOWN_STATUS_COLOR, issues: 0, points: 0 };
          segments.push(segment);
        }
        segment.issues++;
        segment.points += child.storyPoints ?? 0;
      }

      return {
        id: epic.id,
        key: epic.key,
        title: epic.title,
        status: epic.status,
        priority: epic.priority,
        dueDate: epic.dueDate,
        segments: segments.filter((seg) => seg.issues > 0),
        totalPoints,
        completedPoints,
        inProgressPoints,
        todoPoints,
        totalIssues,
        completedIssues,
        inProgressIssues,
        todoIssues,
        completionPct,
      };
    });
  } catch (error) {
    console.error("Failed to build epic progress report:", error);
    return [];
  }
}
