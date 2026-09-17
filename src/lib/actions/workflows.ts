"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  projectIdForWorkflowStatus,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { getWorkflowStatuses, WorkflowStatusCategory, WORKFLOW_STATUS_CATEGORIES } from "@/lib/workflow";

async function revalidateProject(projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
    if (project) revalidatePath(`/projects/${project.key}`);
  } catch {}
}

export async function getProjectWorkflow(projectId: string) {
  try {
    await requireProjectAccess(projectId);
    const [statuses, transitions] = await Promise.all([
      getWorkflowStatuses(projectId),
      prisma.workflowTransition.findMany({ where: { projectId } }),
    ]);
    return { statuses, transitions };
  } catch (error) {
    console.error("Failed to fetch project workflow:", error);
    return { statuses: [], transitions: [] };
  }
}

export async function createWorkflowStatus(
  projectId: string,
  data: {
    name: string;
    category: WorkflowStatusCategory;
    isBacklog?: boolean;
    color?: string;
    wipLimit?: number | null;
  }
) {
  try {
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    const name = data.name.trim();
    if (!name) return { success: false as const, error: "Status name is required." };
    if (!WORKFLOW_STATUS_CATEGORIES.includes(data.category)) {
      return { success: false as const, error: "Unknown status category." };
    }

    const existing = await prisma.workflowStatus.findUnique({
      where: { projectId_name: { projectId, name } },
      select: { id: true },
    });
    if (existing) {
      return { success: false as const, error: `A status named "${name}" already exists.` };
    }

    const maxOrder = await prisma.workflowStatus.aggregate({
      where: { projectId },
      _max: { order: true },
    });

    const status = await prisma.workflowStatus.create({
      data: {
        projectId,
        name,
        category: data.category,
        isBacklog: !!data.isBacklog,
        color: data.color || "#6B7280",
        wipLimit: data.wipLimit ?? null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    await revalidateProject(projectId);
    return { success: true as const, status };
  } catch (error) {
    return toActionError(error, "Failed to create status");
  }
}

export async function updateWorkflowStatus(
  statusId: string,
  data: {
    name?: string;
    category?: WorkflowStatusCategory;
    isBacklog?: boolean;
    color?: string;
    wipLimit?: number | null;
  }
) {
  try {
    const projectId = await projectIdForWorkflowStatus(statusId);
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    if (data.category !== undefined && !WORKFLOW_STATUS_CATEGORIES.includes(data.category)) {
      return { success: false as const, error: "Unknown status category." };
    }

    const existing = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
    if (!existing) return { success: false as const, error: "Status not found." };

    const newName = data.name !== undefined ? data.name.trim() : undefined;
    if (newName !== undefined && !newName) {
      return { success: false as const, error: "Status name is required." };
    }
    if (newName !== undefined && newName !== existing.name) {
      const clash = await prisma.workflowStatus.findUnique({
        where: { projectId_name: { projectId, name: newName } },
        select: { id: true },
      });
      if (clash) return { success: false as const, error: `A status named "${newName}" already exists.` };
    }

    const status = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflowStatus.update({
        where: { id: statusId },
        data: {
          ...(newName !== undefined && { name: newName }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.isBacklog !== undefined && { isBacklog: data.isBacklog }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
        },
      });

      // Existing issues reference the status by name, not id: a rename has to
      // carry them along in the same transaction or they'd point at a status
      // that no longer exists.
      if (newName !== undefined && newName !== existing.name) {
        await tx.issue.updateMany({
          where: { projectId, status: existing.name },
          data: { status: newName },
        });
      }

      return updated;
    });

    await revalidateProject(projectId);
    return { success: true as const, status };
  } catch (error) {
    return toActionError(error, "Failed to update status");
  }
}

export async function deleteWorkflowStatus(statusId: string) {
  try {
    const projectId = await projectIdForWorkflowStatus(statusId);
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    const status = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
    if (!status) return { success: false as const, error: "Status not found." };

    const inUse = await prisma.issue.count({ where: { projectId, status: status.name } });
    if (inUse > 0) {
      return {
        success: false as const,
        error: `${inUse} issue${inUse === 1 ? "" : "s"} still in "${status.name}". Move them to another status first.`,
      };
    }

    const remaining = await prisma.workflowStatus.count({ where: { projectId } });
    if (remaining <= 1) {
      return { success: false as const, error: "A workflow needs at least one status." };
    }

    await prisma.workflowStatus.delete({ where: { id: statusId } });

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete status");
  }
}

export async function reorderWorkflowStatuses(projectId: string, orderedIds: string[]) {
  try {
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    const owned = await prisma.workflowStatus.findMany({
      where: { projectId, id: { in: orderedIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const cleaned = orderedIds.filter((id) => ownedIds.has(id));

    await prisma.$transaction(
      cleaned.map((id, order) => prisma.workflowStatus.update({ where: { id }, data: { order } }))
    );

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to reorder statuses");
  }
}

export async function setWorkflowTransition(
  projectId: string,
  fromId: string,
  toId: string,
  allowed: boolean
) {
  try {
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    if (fromId === toId) {
      return { success: false as const, error: "A status doesn't need a transition to itself." };
    }

    const [from, to] = await Promise.all([
      prisma.workflowStatus.findFirst({ where: { id: fromId, projectId }, select: { id: true } }),
      prisma.workflowStatus.findFirst({ where: { id: toId, projectId }, select: { id: true } }),
    ]);
    if (!from || !to) return { success: false as const, error: "Status not found in this project." };

    if (allowed) {
      await prisma.workflowTransition.upsert({
        where: { fromId_toId: { fromId, toId } },
        create: { projectId, fromId, toId },
        update: {},
      });
    } else {
      await prisma.workflowTransition.deleteMany({ where: { fromId, toId } });
    }

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to update transition");
  }
}
