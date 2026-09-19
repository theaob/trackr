"use server";

import prisma from "@/lib/db";
import { ProjectRole, BuiltInRole, CustomRole, ProjectPermission } from "@/types";
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

const VALID_BUILTIN_ROLES: BuiltInRole[] = ["ADMIN", "MEMBER", "VIEWER"];

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
        customRole: true,
      },
      orderBy: [
        { role: "asc" },
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
  role: ProjectRole = "MEMBER",
  customRoleId?: string | null
) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");

    let targetRole = role;
    let targetCustomRoleId = customRoleId || null;

    if (!VALID_BUILTIN_ROLES.includes(role as BuiltInRole)) {
      const custom = await prisma.customRole.findFirst({
        where: {
          projectId,
          OR: [{ id: role }, { name: role }, ...(customRoleId ? [{ id: customRoleId }] : [])],
        },
      });
      if (!custom) {
        return { success: false, error: "Unknown project role." };
      }
      targetRole = custom.name;
      targetCustomRoleId = custom.id;
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
        role: targetRole,
        customRoleId: targetCustomRoleId,
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        customRole: true,
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
  newRole: ProjectRole,
  customRoleId?: string | null
) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");

    let targetRole = newRole;
    let targetCustomRoleId = customRoleId || null;

    if (!VALID_BUILTIN_ROLES.includes(newRole as BuiltInRole)) {
      const custom = await prisma.customRole.findFirst({
        where: {
          projectId,
          OR: [{ id: newRole }, { name: newRole }, ...(customRoleId ? [{ id: customRoleId }] : [])],
        },
      });
      if (!custom) {
        return { success: false, error: "Unknown project role." };
      }
      targetRole = custom.name;
      targetCustomRoleId = custom.id;
    } else {
      targetCustomRoleId = null;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.leadId === userId && targetRole !== "ADMIN") {
      return {
        success: false,
        error: "The designated Project Lead must always retain the Administrator role.",
      };
    }

    if (targetRole !== "ADMIN") {
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
        role: targetRole,
        customRoleId: targetCustomRoleId,
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        customRole: true,
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

export async function getProjectCustomRoles(projectId: string): Promise<CustomRole[]> {
  try {
    await requireProjectAccess(projectId);
    const roles = await prisma.customRole.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return roles.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      description: r.description,
      color: r.color,
      permissions: JSON.parse(r.permissions || "[]") as ProjectPermission[],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      _count: r._count,
    }));
  } catch (error) {
    console.error("Failed to fetch custom roles:", error);
    return [];
  }
}

export async function createCustomRole(
  projectId: string,
  data: {
    name: string;
    description?: string;
    color?: string;
    permissions: ProjectPermission[];
  }
) {
  try {
    await requireProjectPermission(projectId, "MANAGE_ACCESS");
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      return { success: false, error: "Role name cannot be empty." };
    }

    const reserved = ["ADMIN", "MEMBER", "VIEWER", "ADMINISTRATOR", "LEAD"];
    if (reserved.includes(trimmedName.toUpperCase())) {
      return { success: false, error: "This role name is reserved by the system." };
    }

    const existing = await prisma.customRole.findUnique({
      where: { projectId_name: { projectId, name: trimmedName } },
    });
    if (existing) {
      return { success: false, error: "A role with this name already exists in this project." };
    }

    // Ensure VIEW_PROJECT is always included
    const permsSet = new Set(data.permissions || []);
    permsSet.add("VIEW_PROJECT");

    const customRole = await prisma.customRole.create({
      data: {
        projectId,
        name: trimmedName,
        description: data.description?.trim() || null,
        color: data.color || "#0052cc",
        permissions: JSON.stringify(Array.from(permsSet)),
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
      } catch {}
    }

    return {
      success: true as const,
      role: {
        ...customRole,
        permissions: JSON.parse(customRole.permissions) as ProjectPermission[],
      },
    };
  } catch (error) {
    return toActionError(error, "Failed to create custom role");
  }
}

export async function updateCustomRole(
  roleId: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
    permissions?: ProjectPermission[];
  }
) {
  try {
    const existing = await prisma.customRole.findUnique({ where: { id: roleId } });
    if (!existing) {
      return { success: false, error: "Custom role not found." };
    }

    await requireProjectPermission(existing.projectId, "MANAGE_ACCESS");

    const trimmedName = data.name !== undefined ? data.name.trim() : existing.name;
    if (!trimmedName) {
      return { success: false, error: "Role name cannot be empty." };
    }

    const reserved = ["ADMIN", "MEMBER", "VIEWER", "ADMINISTRATOR", "LEAD"];
    if (reserved.includes(trimmedName.toUpperCase())) {
      return { success: false, error: "This role name is reserved by the system." };
    }

    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.customRole.findUnique({
        where: { projectId_name: { projectId: existing.projectId, name: trimmedName } },
      });
      if (duplicate) {
        return { success: false, error: "A role with this name already exists in this project." };
      }
    }

    let permsString = existing.permissions;
    if (data.permissions) {
      const permsSet = new Set(data.permissions);
      permsSet.add("VIEW_PROJECT");
      permsString = JSON.stringify(Array.from(permsSet));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const role = await tx.customRole.update({
        where: { id: roleId },
        data: {
          name: trimmedName,
          description:
            data.description !== undefined ? data.description.trim() || null : existing.description,
          color: data.color !== undefined ? data.color : existing.color,
          permissions: permsString,
        },
        include: {
          _count: { select: { members: true } },
        },
      });

      // If role name changed, synchronize the string role field on members
      if (trimmedName !== existing.name) {
        await tx.projectMember.updateMany({
          where: { customRoleId: roleId },
          data: { role: trimmedName },
        });
      }

      return role;
    });

    const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
      } catch {}
    }

    return {
      success: true as const,
      role: {
        ...updated,
        permissions: JSON.parse(updated.permissions) as ProjectPermission[],
      },
    };
  } catch (error) {
    return toActionError(error, "Failed to update custom role");
  }
}

export async function deleteCustomRole(roleId: string, fallbackRole: string = "MEMBER") {
  try {
    const existing = await prisma.customRole.findUnique({ where: { id: roleId } });
    if (!existing) {
      return { success: false, error: "Custom role not found." };
    }

    await requireProjectPermission(existing.projectId, "MANAGE_ACCESS");

    await prisma.$transaction(async (tx) => {
      // Safely reassign any members currently assigned to this custom role to the fallback role
      await tx.projectMember.updateMany({
        where: { customRoleId: roleId },
        data: {
          role: fallbackRole,
          customRoleId: null,
        },
      });

      await tx.customRole.delete({
        where: { id: roleId },
      });
    });

    const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
      } catch {}
    }

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete custom role");
  }
}
