"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";


export async function getProjectSprints(projectId: string) {
  try {
    return await prisma.sprint.findMany({
      where: { projectId },
      include: {
        issues: {
          include: {
            assignee: true,
            parent: true,
          },
          orderBy: { order: "asc" },
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

    revalidatePath(`/projects/${project.key}`);
    return { success: true, sprint };
  } catch (error) {
    console.error("Failed to create sprint:", error);
    return { success: false, error: "Failed to create sprint" };
  }
}

export async function startSprint(
  sprintId: string,
  data: { startDate: Date; endDate: Date; goal?: string; name?: string }
) {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) throw new Error("Sprint not found");

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

    revalidatePath(`/projects/${sprint.project.key}`);
    triggerWebhooks("sprint:started", updated, sprint.projectId);
    return { success: true, sprint: updated };
  } catch (error) {
    console.error("Failed to start sprint:", error);
    return { success: false, error: "Failed to start sprint" };
  }
}

export async function completeSprint(sprintId: string, moveToSprintId?: string | null) {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: true,
        issues: true,
      },
    });

    if (!sprint) throw new Error("Sprint not found");

    // Close sprint
    await prisma.sprint.update({
      where: { id: sprintId },
      data: { status: "COMPLETED" },
    });

    // Incomplete issues move to target sprint or backlog
    const incompleteIssues = sprint.issues.filter((issue) => issue.status !== "DONE");
    if (incompleteIssues.length > 0) {
      await prisma.issue.updateMany({
        where: {
          id: { in: incompleteIssues.map((i) => i.id) },
        },
        data: {
          sprintId: moveToSprintId || null,
        },
      });
    }

    revalidatePath(`/projects/${sprint.project.key}`);
    triggerWebhooks(
      "sprint:completed",
      { id: sprint.id, name: sprint.name, projectId: sprint.projectId },
      sprint.projectId
    );
    return { success: true };
  } catch (error) {
    console.error("Failed to complete sprint:", error);
    return { success: false, error: "Failed to complete sprint" };
  }
}


export async function moveIssueToSprint(issueId: string, sprintId: string | null) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!issue) throw new Error("Issue not found");

    if (sprintId) {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
      });
      if (!targetSprint) throw new Error("Sprint not found");
      if (targetSprint.status === "COMPLETED") {
        return { success: false, error: "Cannot add items to finished sprints" };
      }
    }

    const newStatus = sprintId
      ? issue.status === "BACKLOG"
        ? "TODO"
        : issue.status
      : "BACKLOG";

    await prisma.issue.update({
      where: { id: issueId },
      data: {
        sprintId,
        status: newStatus,
      },
    });

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}

    triggerWebhooks(
      "issue:updated",
      { issueId, sprintId, status: newStatus },
      issue.projectId
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to move issue to sprint:", error);
    return { success: false, error: "Failed to move issue to sprint" };
  }
}

export async function renameSprint(sprintId: string, name: string) {
  try {
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

    revalidatePath(`/projects/${sprint.project.key}`);
    return { success: true, sprint: updated };
  } catch (error) {
    console.error("Failed to rename sprint:", error);
    return { success: false, error: "Failed to rename sprint" };
  }
}

export async function deleteSprint(sprintId: string) {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true, issues: true },
    });

    if (!sprint) throw new Error("Sprint not found");
    if (sprint.status === "ACTIVE") {
      return { success: false, error: "Cannot delete an active sprint. Complete it first." };
    }

    // Move all issues back to backlog
    if (sprint.issues.length > 0) {
      await prisma.issue.updateMany({
        where: { sprintId },
        data: { sprintId: null, status: "BACKLOG" },
      });
    }

    await prisma.sprint.delete({ where: { id: sprintId } });

    revalidatePath(`/projects/${sprint.project.key}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete sprint:", error);
    return { success: false, error: "Failed to delete sprint" };
  }
}

