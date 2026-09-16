import prisma from "@/lib/db";
import { ProjectPermission, ProjectRole } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { getCurrentUser, SessionUser } from "@/lib/auth/session";

/**
 * Thrown when a caller is not signed in or lacks a permission. Action catch
 * blocks surface the message via `toActionError` instead of a generic failure.
 */
export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const NOT_SIGNED_IN = "You must be signed in to perform this action.";
const NO_ACCESS = "You do not have access to this project.";

/**
 * Convert a thrown error into an action result message, preserving
 * authorization messages while hiding internal failures behind `fallback`.
 */
export function toActionError(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return { success: false as const, error: error.message };
  }
  console.error(fallback, error);
  return { success: false as const, error: fallback };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(NOT_SIGNED_IN, 401);
  return user;
}

/**
 * The caller's role on a project: ADMIN for the project lead, otherwise the
 * explicit membership role. Absence of a membership means no access — there is
 * deliberately no permissive default.
 */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const [project, member] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { leadId: true },
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    }),
  ]);

  if (!project) return null;
  if (project.leadId === userId) return "ADMIN";
  return (member?.role as ProjectRole | undefined) ?? null;
}

export interface ProjectAuth {
  user: SessionUser;
  role: ProjectRole;
  projectId: string;
}

/** Require the signed-in caller to hold `permission` on `projectId`. */
export async function requireProjectPermission(
  projectId: string,
  permission: ProjectPermission
): Promise<ProjectAuth> {
  const user = await requireUser();
  const role = await getProjectRole(user.id, projectId);

  if (!role) throw new AuthError(NO_ACCESS);
  if (!hasPermission(role, permission)) {
    throw new AuthError("Your project role does not allow this action.");
  }

  return { user, role, projectId };
}

/** Require read access to a project. */
export function requireProjectAccess(projectId: string): Promise<ProjectAuth> {
  return requireProjectPermission(projectId, "VIEW_PROJECT");
}

/**
 * Non-throwing read check, for server components and list queries that should
 * render an empty state rather than an error.
 */
export async function canAccessProject(projectId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const role = await getProjectRole(user.id, projectId);
  return !!role && hasPermission(role, "VIEW_PROJECT");
}

/**
 * Instance-wide settings (SSO, global webhooks) have no dedicated owner in the
 * data model, so they are restricted to users who administer at least one
 * project — the closest thing to an instance administrator available here.
 */
export async function requireAnyProjectAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  const [ledCount, adminMemberships] = await Promise.all([
    prisma.project.count({ where: { leadId: user.id } }),
    prisma.projectMember.count({ where: { userId: user.id, role: "ADMIN" } }),
  ]);

  if (ledCount === 0 && adminMemberships === 0) {
    throw new AuthError("Only a project administrator can change instance settings.");
  }
  return user;
}

/** Project ids the caller may read. */
export async function accessibleProjectIds(userId: string): Promise<string[]> {
  const [led, memberships] = await Promise.all([
    prisma.project.findMany({ where: { leadId: userId }, select: { id: true } }),
    prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    }),
  ]);

  return Array.from(
    new Set([...led.map((p) => p.id), ...memberships.map((m) => m.projectId)])
  );
}

// --- Resolvers: map a child record to the project that governs it -----------

async function projectIdOf<T extends { projectId: string | null } | null>(
  record: T,
  label: string
): Promise<string> {
  if (!record?.projectId) throw new AuthError(`${label} not found.`, 404);
  return record.projectId;
}

export async function projectIdForIssue(issueId: string): Promise<string> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  });
  return projectIdOf(issue, "Issue");
}

export async function projectIdForSprint(sprintId: string): Promise<string> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });
  return projectIdOf(sprint, "Sprint");
}

export async function projectIdForVersion(versionId: string): Promise<string> {
  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { projectId: true },
  });
  return projectIdOf(version, "Version");
}

export async function projectIdForCustomField(fieldId: string): Promise<string> {
  const field = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: { projectId: true },
  });
  return projectIdOf(field, "Custom field");
}

export async function projectIdForComment(commentId: string): Promise<string> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { issue: { select: { projectId: true } } },
  });
  return projectIdOf(comment?.issue ?? null, "Comment");
}
