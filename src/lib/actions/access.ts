"use server";

import prisma from "@/lib/db";
import { ProjectRole } from "@/types";
import { revalidatePath } from "next/cache";
import { PUBLIC_USER_SELECT } from "@/lib/auth/publicUser";
import {
  isProjectTeamMember,
  requireProjectAccess,
  requireProjectPermission,
  requireUser,
  toActionError,
} from "@/lib/auth/guards";
import { ensureProjectMembersSeeded } from "@/lib/projectMembers";

const VALID_ROLES: ProjectRole[] = ["ADMIN", "MEMBER", "VIEWER"];

export async function getProjectMembers(projectId: string) {
  try {
    // The roster carries the team's email addresses, so it is restricted to
    // the team. Read access gained only because a project is published to
    // anonymous viewers is not enough.
    const user = await requireUser();
    await requireProjectAccess(projectId);

    if (!(await isProjectTeamMember(user.id, projectId))) {
      return [];
    }

    // Auto-seed members for project if none exist yet
    await ensureProjectMembersSeeded(projectId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
      orderBy: [
        { role: "asc" }, // ADMIN, MEMBER, VIEWER alphabetical or custom
        { createdAt: "asc" },
      ],
    });

    return members;
  } catch (error) {
    console.error("Failed to fetch project members:", error);
    return [];
  }
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole = "MEMBER"
) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");

    if (!VALID_ROLES.includes(role)) {
      return { success: false, error: "Unknown project role." };
    }

    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existing) {
      return { success: false, error: "User is already a member of this project" };
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
        revalidatePath(`/projects/${project.key}/backlog`);
      } catch {}
    }

    return { success: true as const, member };
  } catch (error) {
    return toActionError(error, "Failed to add project member");
  }
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  newRole: ProjectRole
) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");

    if (!VALID_ROLES.includes(newRole)) {
      return { success: false, error: "Unknown project role." };
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.leadId === userId && newRole !== "ADMIN") {
      return {
        success: false,
        error: "The designated Project Lead must always retain the Administrator role.",
      };
    }

    if (newRole !== "ADMIN") {
      const [current, adminCount] = await Promise.all([
        prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
          select: { role: true },
        }),
        prisma.projectMember.count({ where: { projectId, role: "ADMIN" } }),
      ]);

      if (current?.role === "ADMIN" && adminCount <= 1) {
        return {
          success: false,
          error: "A project must keep at least one administrator.",
        };
      }
    }

    const updated = await prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: {
        role: newRole,
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
        revalidatePath(`/projects/${project.key}/backlog`);
      } catch {}
    }

    return { success: true as const, member: updated };
  } catch (error) {
    return toActionError(error, "Failed to update project member role");
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.leadId === userId) {
      return {
        success: false,
        error: "Cannot remove the designated Project Lead from the project.",
      };
    }

    const [target, adminCount] = await Promise.all([
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      }),
      prisma.projectMember.count({ where: { projectId, role: "ADMIN" } }),
    ]);

    if (target?.role === "ADMIN" && adminCount <= 1) {
      return {
        success: false,
        error: "A project must keep at least one administrator.",
      };
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
        revalidatePath(`/projects/${project.key}/backlog`);
      } catch {}
    }

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to remove project member");
  }
}
