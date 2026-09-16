import prisma from "@/lib/db";
import { ProjectRole } from "@/types";

/**
 * Give a project an explicit membership list when it has none.
 *
 * This exists only to migrate projects created before memberships were
 * required; without it those projects would be invisible to everyone but the
 * lead. It is deliberately not a server action -- nothing reachable from a
 * browser should be able to grant project access in bulk.
 */
export async function ensureProjectMembersSeeded(projectId: string) {
  try {
    const count = await prisma.projectMember.count({ where: { projectId } });
    if (count > 0) return;

    const [project, allUsers] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, leadId: true },
      }),
      prisma.user.findMany({
        select: { id: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!project || allUsers.length === 0) return;

    // Project Lead -> ADMIN, QA roles -> VIEWER, everyone else -> MEMBER.
    const rows = allUsers.map((user) => {
      let role: ProjectRole = "MEMBER";
      if (user.id === project.leadId) {
        role = "ADMIN";
      } else if (user.role.toLowerCase().includes("qa")) {
        role = "VIEWER";
      }
      return { projectId, userId: user.id, role };
    });

    await prisma.projectMember.createMany({ data: rows });
  } catch (error) {
    console.error("Failed to seed project members:", error);
  }
}
