"use server";

import prisma from "@/lib/db";
import { ProjectRole } from "@/types";
import { revalidatePath } from "next/cache";

export async function getProjectMembers(projectId: string) {
  try {
    // Auto-seed members for project if none exist yet
    await ensureProjectMembersSeeded(projectId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: true,
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
        user: true,
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

    return { success: true, member };
  } catch (error) {
    console.error("Failed to add project member:", error);
    return { success: false, error: "Failed to add project member" };
  }
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  newRole: ProjectRole
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.leadId === userId && newRole !== "ADMIN") {
      return {
        success: false,
        error: "The designated Project Lead must always retain the Administrator role.",
      };
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
        user: true,
      },
    });

    if (project) {
      try {
        revalidatePath(`/projects/${project.key}/settings`);
        revalidatePath(`/projects/${project.key}/board`);
        revalidatePath(`/projects/${project.key}/backlog`);
      } catch {}
    }

    return { success: true, member: updated };
  } catch (error) {
    console.error("Failed to update project member role:", error);
    return { success: false, error: "Failed to update project member role" };
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.leadId === userId) {
      return {
        success: false,
        error: "Cannot remove the designated Project Lead from the project.",
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

    return { success: true };
  } catch (error) {
    console.error("Failed to remove project member:", error);
    return { success: false, error: "Failed to remove project member" };
  }
}

export async function ensureProjectMembersSeeded(projectId: string) {
  try {
    const count = await prisma.projectMember.count({
      where: { projectId },
    });

    if (count > 0) return;

    // Fetch project and all organization users
    const [project, allUsers] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    if (!project || allUsers.length === 0) return;

    // Seed team members with sensible default roles:
    // - Project Lead -> ADMIN
    // - QA Engineer (Marcus Vance) -> VIEWER (Stakeholder demo)
    // - Others -> MEMBER
    for (const user of allUsers) {
      let role: ProjectRole = "MEMBER";
      if (user.id === project.leadId) {
        role = "ADMIN";
      } else if (user.role.toLowerCase().includes("qa")) {
        role = "VIEWER";
      }

      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: user.id,
          },
        },
        create: {
          projectId,
          userId: user.id,
          role,
        },
        update: {},
      });
    }
  } catch (error) {
    console.error("Failed to seed project members:", error);
  }
}
