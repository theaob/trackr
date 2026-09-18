"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  projectIdForComponent,
  projectIdForIssue,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import { isValidComponentName, normalizeComponentName } from "@/lib/components";

async function revalidateProject(projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
    if (project) revalidatePath(`/projects/${project.key}`);
  } catch {}
}

/** A project's defined components, for the settings table and the issue picker. */
export async function getProjectComponents(projectId: string) {
  try {
    await requireProjectAccess(projectId);
    return await prisma.component.findMany({
      where: { projectId },
      include: {
        lead: { select: DISPLAY_USER_SELECT },
        _count: { select: { issues: true } },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch project components:", error);
    return [];
  }
}

export async function createComponent(data: {
  projectId: string;
  name: string;
  description?: string;
  leadId?: string | null;
}) {
  try {
    await requireProjectPermission(data.projectId, "PROJECT_ADMIN");

    const name = normalizeComponentName(data.name);
    if (!isValidComponentName(name)) {
      return { success: false as const, error: "Please enter a valid component name." };
    }

    const existing = await prisma.component.findUnique({
      where: { projectId_name: { projectId: data.projectId, name } },
    });
    if (existing) {
      return { success: false as const, error: `A component named "${name}" already exists.` };
    }

    const component = await prisma.component.create({
      data: {
        projectId: data.projectId,
        name,
        description: data.description?.trim() || null,
        leadId: data.leadId || null,
      },
      include: {
        lead: { select: DISPLAY_USER_SELECT },
        _count: { select: { issues: true } },
      },
    });

    await revalidateProject(data.projectId);
    return { success: true as const, component };
  } catch (error) {
    return toActionError(error, "Failed to create component");
  }
}

export async function updateComponent(
  id: string,
  data: { name?: string; description?: string | null; leadId?: string | null }
) {
  try {
    const projectId = await projectIdForComponent(id);
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    let name: string | undefined;
    if (data.name !== undefined) {
      name = normalizeComponentName(data.name);
      if (!isValidComponentName(name)) {
        return { success: false as const, error: "Please enter a valid component name." };
      }
      const existing = await prisma.component.findUnique({
        where: { projectId_name: { projectId, name } },
      });
      if (existing && existing.id !== id) {
        return { success: false as const, error: `A component named "${name}" already exists.` };
      }
    }

    const component = await prisma.component.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.leadId !== undefined && { leadId: data.leadId || null }),
      },
      include: {
        lead: { select: DISPLAY_USER_SELECT },
        _count: { select: { issues: true } },
      },
    });

    await revalidateProject(projectId);
    return { success: true as const, component };
  } catch (error) {
    return toActionError(error, "Failed to update component");
  }
}

export async function deleteComponent(id: string) {
  try {
    const projectId = await projectIdForComponent(id);
    await requireProjectPermission(projectId, "PROJECT_ADMIN");

    await prisma.component.delete({ where: { id } });

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete component");
  }
}

export async function addIssueComponent(issueId: string, componentId: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const component = await prisma.component.findUnique({ where: { id: componentId } });
    if (!component || component.projectId !== projectId) {
      return { success: false as const, error: "Component not found in this project." };
    }

    const existing = await prisma.issueComponent.findUnique({
      where: { issueId_componentId: { issueId, componentId } },
    });
    if (existing) {
      return { success: true as const, issueComponent: { ...existing, component } };
    }

    const issueComponent = await prisma.issueComponent.create({
      data: { issueId, componentId },
    });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "COMPONENT_ADDED",
        field: "components",
        newValue: component.name,
      },
    });

    await revalidateProject(projectId);
    return { success: true as const, issueComponent: { ...issueComponent, component } };
  } catch (error) {
    return toActionError(error, "Failed to add component");
  }
}

export async function removeIssueComponent(issueId: string, componentId: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const issueComponent = await prisma.issueComponent.findUnique({
      where: { issueId_componentId: { issueId, componentId } },
      include: { component: true },
    });
    if (!issueComponent) return { success: true as const };

    await prisma.issueComponent.delete({ where: { id: issueComponent.id } });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "COMPONENT_REMOVED",
        field: "components",
        newValue: issueComponent.component.name,
      },
    });

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to remove component");
  }
}
