"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import {
  projectIdForSprint,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { getDoneStatusNames, getInitialStatusName, getPrimaryBacklogStatusName } from "@/lib/workflow";
import { planColumnOrder } from "@/lib/boardOrder";


/** Sprint issues per sprint, bounded so a large backlog cannot be loaded whole. */
const SPRINT_ISSUE_LIMIT = 200;

function revalidateProjectRoutes(projectKey: string) {
  try {
    revalidatePath(`/projects/${projectKey}`);
    revalidatePath(`/projects/${projectKey}/board`);
    revalidatePath(`/projects/${projectKey}/backlog`);
    revalidatePath(`/projects/${projectKey}/reports`);
    revalidatePath(`/projects/${projectKey}/issues`);
  } catch {}
}

export async function getProjectSprints(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { boardType: true },
    });
    if (project?.boardType === "KANBAN") {
      return [];
    }

    return await prisma.sprint.findMany({
      where: { projectId },
      include: {
        issues: {
          include: {
            assignee: { select: DISPLAY_USER_SELECT },
            parent: {
              select: { id: true, key: true, title: true, type: true },
            },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          take: SPRINT_ISSUE_LIMIT,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch sprints:", error);
    return [];
  }
}

export async function createSprint(projectId: string, name: string, goal?: string) {
  try {
    const { user } = await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true, boardType: true },
    });

    if (!project) throw new Error("Project not found");

    if (project.boardType === "KANBAN") {
      return { success: false, error: "Kanban projects do not use sprints" };
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        goal: goal || null,
        status: "FUTURE",
        projectId,
      },
    });

    revalidateProjectRoutes(project.key);
    triggerWebhooks("sprint:created", sprint, projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
    return { success: true as const, sprint };
  } catch (error) {
    return toActionError(error, "Failed to create sprint");
  }
}

export async function startSprint(
  sprintId: string,
  data: { startDate: Date; endDate: Date; goal?: string; name?: string }
) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    const { user } = await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) throw new Error("Sprint not found");

    if (sprint.project.boardType === "KANBAN") {
      return { success: false, error: "Kanban projects do not use sprints" };
    }

    if (sprint.status === "COMPLETED") {
      return { success: false, error: "A completed sprint cannot be started again." };
    }

    // A board shows exactly one active sprint, so refuse to create a second.
    const otherActive = await prisma.sprint.findFirst({
      where: { projectId, status: "ACTIVE", id: { not: sprintId } },
      select: { name: true },
    });
    if (otherActive) {
      return {
        success: false,
        error: `${otherActive.name} is already active. Complete it before starting another sprint.`,
      };
    }

    if (data.endDate <= data.startDate) {
      return { success: false, error: "The sprint end date must come after its start date." };
    }

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: "ACTIVE",
        startDate: data.startDate,
        endDate: data.endDate,
        ...(data.name?.trim() && { name: data.name.trim() }),
        ...(data.goal !== undefined && { goal: data.goal }),
      },
    });

    revalidateProjectRoutes(sprint.project.key);
    triggerWebhooks("sprint:started", updated, sprint.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
    return { success: true as const, sprint: updated };
  } catch (error) {
    return toActionError(error, "Failed to start sprint");
  }
}

export async function completeSprint(sprintId: string, moveToSprintId?: string | null) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    const { user } = await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, name: true, projectId: true, status: true, project: true },
    });

    if (!sprint) throw new Error("Sprint not found");
    if (sprint.project.boardType === "KANBAN") {
      return { success: false, error: "Kanban projects do not use sprints" };
    }
    if (sprint.status === "COMPLETED") {
      return { success: false, error: "This sprint is already complete." };
    }

    if (moveToSprintId) {
      const target = await prisma.sprint.findUnique({
        where: { id: moveToSprintId },
        select: { projectId: true, status: true },
      });
      if (!target || target.projectId !== projectId) {
        return { success: false, error: "Target sprint not found in this project" };
      }
      if (target.status === "COMPLETED") {
        return { success: false, error: "Cannot roll issues into a finished sprint" };
      }
    }

    const [doneNames, backlogStatusName] = await Promise.all([
      getDoneStatusNames(projectId),
      moveToSprintId ? Promise.resolve(null) : getPrimaryBacklogStatusName(projectId),
    ]);

    // Closing the sprint and rolling its issues over is one unit of work: a
    // failure partway through must not leave a closed sprint holding open
    // issues.
    await prisma.$transaction([
      prisma.sprint.update({
        where: { id: sprintId },
        data: { status: "COMPLETED" },
      }),
      prisma.issue.updateMany({
        where: { sprintId, status: { notIn: doneNames } },
        data: moveToSprintId
          ? { sprintId: moveToSprintId }
          : // Back to the backlog, which means the backlog status too --
            // otherwise the issues reappear on the board with no sprint.
            { sprintId: null, status: backlogStatusName! },
      }),
    ]);

    revalidateProjectRoutes(sprint.project.key);
    triggerWebhooks(
      "sprint:completed",
      { id: sprint.id, name: sprint.name, projectId: sprint.projectId },
      sprint.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      }
    );
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to complete sprint");
  }
}


export async function moveIssueToSprint(
  issueId: string,
  sprintId: string | null,
  newOrder?: number,
  orderedIssueIds?: string[]
) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!issue) throw new Error("Issue not found");

    await requireProjectPermission(issue.projectId, "MOVE_ISSUE");

    if (sprintId) {
      if (issue.project.boardType === "KANBAN") {
        return { success: false, error: "Kanban projects do not use sprints" };
      }
      if (issue.type === "EPIC") {
        return { success: false, error: "Epics cannot be assigned to a sprint" };
      }
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
        select: { projectId: true, status: true },
      });
      if (!targetSprint || targetSprint.projectId !== issue.projectId) {
        return { success: false, error: "Sprint not found in this project" };
      }
      if (targetSprint.status === "COMPLETED") {
        return { success: false, error: "Cannot add items to finished sprints" };
      }
    }

    const backlogStatusName = await getPrimaryBacklogStatusName(issue.projectId);
    const newStatus = sprintId
      ? issue.status === backlogStatusName
        ? await getInitialStatusName(issue.projectId)
        : issue.status
      : backlogStatusName;

    const statusChanged = issue.status !== newStatus;
    const sprintChanged = issue.sprintId !== sprintId;

    if (orderedIssueIds && orderedIssueIds.length > 0 && newOrder !== undefined) {
      // Validate sibling IDs belong to the same project
      const siblingIds = orderedIssueIds
        .filter((id) => id !== issueId)
        .slice(0, 500);

      const validSiblingIds = siblingIds.length
        ? (
            await prisma.issue.findMany({
              where: { id: { in: siblingIds }, projectId: issue.projectId },
              select: { id: true },
            })
          ).map((row) => row.id)
        : [];

      const { resolvedOrder, siblingWrites } = planColumnOrder(
        issueId,
        orderedIssueIds,
        validSiblingIds,
        newOrder
      );

      await prisma.$transaction([
        prisma.issue.update({
          where: { id: issueId },
          data: {
            sprintId,
            status: newStatus,
            order: resolvedOrder,
          },
        }),
        ...siblingWrites.map(({ id, order }) =>
          prisma.issue.update({ where: { id }, data: { order } })
        ),
      ]);
    } else {
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          sprintId,
          status: newStatus,
        },
      });
    }

    revalidateProjectRoutes(issue.project.key);

    if (statusChanged || sprintChanged) {
      triggerWebhooks(
        "issue:updated",
        { issueId, sprintId, status: newStatus },
        issue.projectId
      );
    }

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to move issue to sprint");
  }
}

export async function reorderBacklogIssue(
  issueId: string,
  targetSprintId: string | null,
  newOrder: number,
  orderedIssueIds: string[]
) {
  return moveIssueToSprint(issueId, targetSprintId, newOrder, orderedIssueIds);
}

export async function updateSprint(
  sprintId: string,
  data: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    goal?: string | null;
  }
) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    const { user } = await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) throw new Error("Sprint not found");

    if (sprint.project.boardType === "KANBAN") {
      return { success: false, error: "Kanban projects do not use sprints" };
    }

    const trimmedName = data.name !== undefined ? data.name.trim() : undefined;
    if (trimmedName !== undefined && !trimmedName) {
      return { success: false, error: "Sprint name cannot be empty" };
    }

    const newStart = data.startDate !== undefined ? data.startDate : sprint.startDate;
    const newEnd = data.endDate !== undefined ? data.endDate : sprint.endDate;

    if (newStart && newEnd && newEnd <= newStart) {
      return { success: false, error: "The sprint end date must come after its start date." };
    }

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(trimmedName !== undefined && { name: trimmedName }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.goal !== undefined && { goal: data.goal ? data.goal.trim() : null }),
      },
      include: { project: true },
    });

    revalidateProjectRoutes(sprint.project.key);
    triggerWebhooks("sprint:updated", updated, sprint.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
    return { success: true as const, sprint: updated };
  } catch (error) {
    return toActionError(error, "Failed to update sprint");
  }
}

export async function renameSprint(sprintId: string, name: string) {
  return updateSprint(sprintId, { name });
}

export async function deleteSprint(sprintId: string) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    const { user } = await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, name: true, status: true, project: true },
    });

    if (!sprint) throw new Error("Sprint not found");
    if (sprint.project.boardType === "KANBAN") {
      return { success: false, error: "Kanban projects do not use sprints" };
    }
    if (sprint.status === "ACTIVE") {
      return { success: false, error: "Cannot delete an active sprint. Complete it first." };
    }

    const backlogStatusName = await getPrimaryBacklogStatusName(projectId);

    // Return the sprint's issues to the backlog, then remove it, as one unit.
    await prisma.$transaction([
      prisma.issue.updateMany({
        where: { sprintId },
        data: { sprintId: null, status: backlogStatusName },
      }),
      prisma.sprint.delete({ where: { id: sprintId } }),
    ]);

    revalidateProjectRoutes(sprint.project.key);
    triggerWebhooks(
      "sprint:deleted",
      { id: sprint.id, name: sprint.name, projectId },
      projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      }
    );
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete sprint");
  }
}
