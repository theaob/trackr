"use server";

import prisma from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth/guards";
import { getDoneStatusNames, getWorkflowStatuses } from "@/lib/workflow";

/**
 * Every epic in a project, each with its own start/due dates (set on the
 * epic itself, not derived) and a rollup of its children's completion --
 * everything the Roadmap timeline needs in one call.
 */
export async function getEpicRoadmap(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    const epics = await prisma.issue.findMany({
      where: { projectId, type: "EPIC" },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (epics.length === 0) return [];

    const [doneNames, statuses] = await Promise.all([
      getDoneStatusNames(projectId),
      getWorkflowStatuses(projectId),
    ]);
    const colorByStatus = new Map(statuses.map((s) => [s.name, s.color]));

    const children = await prisma.issue.findMany({
      where: { parentId: { in: epics.map((e) => e.id) } },
      select: { parentId: true, status: true, storyPoints: true },
    });

    const rollupByEpic = new Map<
      string,
      { totalCount: number; completedCount: number; totalPoints: number; completedPoints: number }
    >();
    for (const child of children) {
      const epicId = child.parentId!;
      const rollup = rollupByEpic.get(epicId) ?? {
        totalCount: 0,
        completedCount: 0,
        totalPoints: 0,
        completedPoints: 0,
      };
      const isDone = doneNames.includes(child.status);
      const points = child.storyPoints ?? 0;
      rollup.totalCount += 1;
      rollup.totalPoints += points;
      if (isDone) {
        rollup.completedCount += 1;
        rollup.completedPoints += points;
      }
      rollupByEpic.set(epicId, rollup);
    }

    return epics.map((epic) => {
      const rollup = rollupByEpic.get(epic.id) ?? {
        totalCount: 0,
        completedCount: 0,
        totalPoints: 0,
        completedPoints: 0,
      };
      return {
        id: epic.id,
        key: epic.key,
        title: epic.title,
        status: epic.status,
        statusColor: colorByStatus.get(epic.status) ?? "#0052CC",
        isDone: doneNames.includes(epic.status),
        startDate: epic.startDate,
        dueDate: epic.dueDate,
        ...rollup,
      };
    });
  } catch (error) {
    console.error("Failed to build epic roadmap:", error);
    return [];
  }
}
