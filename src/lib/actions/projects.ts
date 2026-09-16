"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PUBLIC_USER_SELECT } from "@/lib/auth/publicUser";
import {
  accessibleProjectIds,
  canAccessProject,
  isProjectTeamMember,
  teamProjectIds,
  requireProjectAccess,
  requireProjectPermission,
  requireUser,
  toActionError,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureProjectMembersSeeded } from "@/lib/projectMembers";

const PROJECT_INCLUDE = {
  lead: { select: PUBLIC_USER_SELECT },
  members: { select: { userId: true, role: true } },
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
  category?: string;
  leadId?: string;
}) {
  try {
    const user = await requireUser();

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
        category: data.category || "Software Development",
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

    const openCounts = await prisma.issue.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, status: { not: "DONE" } },
      _count: { _all: true },
    });
    const openByProject = new Map(
      openCounts.map((row) => [row.projectId, row._count._all])
    );

    const teamIds = await teamProjectIds(user?.id);

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      category: p.category,
      lead: hideLeadEmail(p, teamIds).lead,
      leadId: p.leadId,
      allowAnonymousViewers: p.allowAnonymousViewers,
      members: p.members,
      totalIssues: p._count.issues,
      openIssues: openByProject.get(p.id) ?? 0,
      activeSprint: p.sprints.length > 0 ? p.sprints[0].name : null,
    }));
  } catch (error) {
    console.error("Failed to fetch projects with stats:", error);
    return [];
  }
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string; allowAnonymousViewers?: boolean }
) {
  try {
    await requireProjectPermission(id, "PROJECT_ADMIN");

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
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
