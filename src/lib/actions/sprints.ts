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
    await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    if (!project) throw new Error("Project not found");

    const sprint = await prisma.sprint.create({
      data: {
        name,
        goal: goal || null,
        status: "FUTURE",
        projectId,
      },
    });

    revalidateProjectRoutes(project.key);
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
    await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) throw new Error("Sprint not found");

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
    triggerWebhooks("sprint:started", updated, sprint.projectId);
    return { success: true as const, sprint: updated };
  } catch (error) {
    return toActionError(error, "Failed to start sprint");
  }
}

export async function completeSprint(sprintId: string, moveToSprintId?: string | null) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, name: true, projectId: true, status: true, project: true },
    });

    if (!sprint) throw new Error("Sprint not found");
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
      sprint.projectId
    );
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to complete sprint");
  }
}


export async function moveIssueToSprint(issueId: string, sprintId: string | null) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!issue) throw new Error("Issue not found");

    await requireProjectPermission(issue.projectId, "MOVE_ISSUE");

    if (sprintId) {
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

    await prisma.issue.update({
      where: { id: issueId },
      data: {
        sprintId,
        status: newStatus,
      },
    });

    revalidateProjectRoutes(issue.project.key);

    triggerWebhooks(
      "issue:updated",
      { issueId, sprintId, status: newStatus },
      issue.projectId
    );

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to move issue to sprint");
  }
}

export async function renameSprint(sprintId: string, name: string) {
  try {
    await requireProjectPermission(await projectIdForSprint(sprintId), "MANAGE_SPRINTS");

    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: "Sprint name cannot be empty" };

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) throw new Error("Sprint not found");

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: { name: trimmed },
    });

    revalidateProjectRoutes(sprint.project.key);
    return { success: true as const, sprint: updated };
  } catch (error) {
    return toActionError(error, "Failed to rename sprint");
  }
}

export async function deleteSprint(sprintId: string) {
  try {
    const projectId = await projectIdForSprint(sprintId);
    await requireProjectPermission(projectId, "MANAGE_SPRINTS");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, status: true, project: true },
    });

    if (!sprint) throw new Error("Sprint not found");
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
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete sprint");
  }
}

