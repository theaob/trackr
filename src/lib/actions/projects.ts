"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { BoardType } from "@/types";
import { PUBLIC_USER_SELECT } from "@/lib/auth/publicUser";
import {
  accessibleProjectIds,
  canAccessProject,
  isProjectTeamMember,
  teamProjectIds,
  requireProjectAccess,
  requireProjectPermission,
  requireUser,
  requireCanCreateProject,
  requireInstanceAdmin,
  toActionError,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureProjectMembersSeeded } from "@/lib/projectMembers";
import { seedDefaultWorkflow } from "@/lib/workflow";

const PROJECT_INCLUDE = {
  lead: { select: PUBLIC_USER_SELECT },
  members: { select: { userId: true, role: true } },
  // Every permission check outside Project Settings resolves a member's role
  // through this same `project` object (useProjectPermissions falls back to
  // `project.customRoles` when no separate list is passed in), so a member
  // assigned to a custom role needs it here to have any permissions at all
  // anywhere but Settings -- not just on custom-role-name display.
  customRoles: { select: { id: true, name: true, description: true, color: true, permissions: true } },
} as const;

/**
 * Strip the project lead's email address unless the caller is on that project's
 * team. A published project exposes its issues, not its team's contact details.
 */
function hideLeadEmail<T extends { id: string; lead?: { email: string } | null }>(
  project: T,
  teamIds: Set<string>
): T {
  if (!project.lead || teamIds.has(project.id)) return project;
  return { ...project, lead: { ...project.lead, email: "" } };
}

/**
 * Projects created before membership rows existed have an empty member list,
 * which would otherwise make them invisible to everyone but the lead. Seed them
 * once per process; `ensureProjectMembersSeeded` is a no-op when members exist.
 */
let backfillPromise: Promise<void> | null = null;

function backfillLegacyProjectMembers(): Promise<void> {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      const orphans = await prisma.project.findMany({
        where: { members: { none: {} } },
        select: { id: true },
      });
      for (const project of orphans) {
        await ensureProjectMembersSeeded(project.id);
      }
    })().catch((error) => {
      console.error("Failed to backfill legacy project members:", error);
      backfillPromise = null;
    });
  }
  return backfillPromise;
}

/**
 * Projects the caller can see: those they lead or belong to, plus any project
 * published to anonymous viewers. Works without a session.
 */
export async function getProjects() {
  try {
    const user = await getCurrentUser();
    await backfillLegacyProjectMembers();

    const ids = await accessibleProjectIds(user?.id ?? null);
    if (ids.length === 0) return [];

    const [projects, teamIds] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: ids } },
        include: PROJECT_INCLUDE,
        orderBy: { createdAt: "asc" },
      }),
      teamProjectIds(user?.id),
    ]);

    return projects.map((project) => hideLeadEmail(project, teamIds));
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return [];
  }
}

export async function getProjectByKey(key: string) {
  try {
    await backfillLegacyProjectMembers();

    const project = await prisma.project.findUnique({
      where: { key: key.toUpperCase() },
      include: {
        ...PROJECT_INCLUDE,
        sprints: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) return null;
    if (!(await canAccessProject(project.id))) return null;

    return hideLeadEmail(project, await teamProjectIds((await getCurrentUser())?.id));
  } catch (error) {
    console.error(`Failed to fetch project with key ${key}:`, error);
    return null;
  }
}

/**
 * The user directory, limited to fields that are safe in a browser payload.
 * Credential columns are never selected.
 */
export async function getAllUsers() {
  try {
    await requireUser();
    return await prisma.user.findMany({
      select: PUBLIC_USER_SELECT,
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

/**
 * Members of a single project, for assignee and mention pickers.
 *
 * On a published project this is readable by visitors and by signed-in
 * non-members, so email addresses are withheld from anyone who is not on the
 * team: the issues are public, the team's contact details are not.
 */
export async function getProjectUsers(projectId: string) {
  try {
    const { user: caller } = await requireProjectAccess(projectId);
    const onTheTeam = await isProjectTeamMember(caller?.id, projectId);

    const [members, project] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        select: { user: { select: PUBLIC_USER_SELECT } },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { lead: { select: PUBLIC_USER_SELECT } },
      }),
    ]);

    const byId = new Map(members.map((m) => [m.user.id, m.user]));
    if (project?.lead) byId.set(project.lead.id, project.lead);

    const users = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (onTheTeam) return users;

    return users.map((user) => ({ ...user, email: "" }));
  } catch (error) {
    console.error("Failed to fetch project users:", error);
    return [];
  }
}

export async function createProject(data: {
  name: string;
  key: string;
  description?: string;
  leadId?: string;
}) {
  try {
    const user = await requireCanCreateProject();

    const formattedKey = data.key.trim().toUpperCase();
    if (!formattedKey.match(/^[A-Z0-9]{2,10}$/)) {
      return {
        success: false,
        error: "Project key must be 2-10 alphanumeric uppercase characters.",
      };
    }

    const existing = await prisma.project.findUnique({
      where: { key: formattedKey },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: `A project with key ${formattedKey} already exists.` };
    }

    // The creator always gets administrator access, so a new project is never
    // left without an owner, and is never visible to anyone else by default.
    const leadId = data.leadId || user.id;
    const memberRoles = new Map<string, string>([[user.id, "ADMIN"]]);
    memberRoles.set(leadId, "ADMIN");

    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        key: formattedKey,
        description: data.description || "",
        leadId,
        members: {
          create: Array.from(memberRoles, ([userId, role]) => ({ userId, role })),
        },
        sprints: {
          create: {
            name: "Sprint 1",
            status: "FUTURE",
            goal: "Initial sprint planning and setup.",
          },
        },
      },
      include: { lead: { select: PUBLIC_USER_SELECT } },
    });

    // Best-effort: a failure here isn't fatal, since the workflow is seeded
    // lazily on first read too (getWorkflowStatuses -> ensureProjectWorkflowSeeded).
    await seedDefaultWorkflow(prisma, project.id).catch((error) => {
      console.error("Failed to seed default workflow for new project:", error);
    });

    try {
      revalidatePath("/projects");
    } catch {}
    return { success: true as const, project };
  } catch (error) {
    return toActionError(error, "Failed to create project");
  }
}

export async function getAllProjectsWithStats() {
  try {
    const user = await getCurrentUser();
    await backfillLegacyProjectMembers();

    const ids = await accessibleProjectIds(user?.id ?? null);
    if (ids.length === 0) return [];

    // Counts are aggregated in SQL; loading every issue row to call .length on
    // it does not survive a real backlog.
    const projects = await prisma.project.findMany({
      where: { id: { in: ids } },
      include: {
        ...PROJECT_INCLUDE,
        sprints: {
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
          take: 1,
        },
        _count: { select: { issues: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Grouped by (project, status) rather than filtered by a single "DONE"
    // literal: each project can rename or redefine its Done-category
    // statuses, so what counts as open is resolved per project below.
    const [statusCounts, doneStatuses] = await Promise.all([
      prisma.issue.groupBy({
        by: ["projectId", "status"],
        where: { projectId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.workflowStatus.findMany({
        where: { projectId: { in: ids }, category: "DONE" },
        select: { projectId: true, name: true },
      }),
    ]);
    const doneKeys = new Set(doneStatuses.map((s) => `${s.projectId}:${s.name}`));
    const openByProject = new Map<string, number>();
    for (const row of statusCounts) {
      if (doneKeys.has(`${row.projectId}:${row.status}`)) continue;
      openByProject.set(row.projectId, (openByProject.get(row.projectId) ?? 0) + row._count._all);
    }

    const teamIds = await teamProjectIds(user?.id);

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      lead: hideLeadEmail(p, teamIds).lead,
      leadId: p.leadId,
      allowAnonymousViewers: p.allowAnonymousViewers,
      members: p.members,
      totalIssues: p._count.issues,
      openIssues: openByProject.get(p.id) ?? 0,
      activeSprint: p.sprints.length > 0 ? p.sprints[0].name : null,
      boardType: (p.boardType as BoardType) || "SCRUM",
    }));
  } catch (error) {
    console.error("Failed to fetch projects with stats:", error);
    return [];
  }
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    allowAnonymousViewers?: boolean;
    boardType?: string;
  }
) {
  try {
    await requireProjectPermission(id, "PROJECT_ADMIN");

    if (data.boardType !== undefined && data.boardType !== "SCRUM" && data.boardType !== "KANBAN") {
      return { success: false as const, error: "Board type must be Scrum or Kanban." };
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.boardType !== undefined && { boardType: data.boardType }),
        // Publishing a project to anonymous viewers is an administrator
        // decision, and grants read-only access only.
        ...(data.allowAnonymousViewers !== undefined && {
          allowAnonymousViewers: data.allowAnonymousViewers,
        }),
      },
    });

    try {
      revalidatePath(`/projects/${updated.key}`);
    } catch {}
    return { success: true as const, project: updated };
  } catch (error) {
    return toActionError(error, "Failed to update project");
  }
}

/**
 * Grant or revoke project creation permission for a user.
 * Restricted to instance administrators.
 */
export async function updateUserProjectPermission(userId: string, canCreateProjects: boolean) {
  try {
    await requireInstanceAdmin();

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { canCreateProjects },
      select: PUBLIC_USER_SELECT,
    });

    try {
      revalidatePath("/settings");
      revalidatePath("/projects");
      revalidatePath("/", "layout");
    } catch {}

    return { success: true as const, user: updated };
  } catch (error) {
    return toActionError(error, "Failed to update user project creation permission");
  }
}

