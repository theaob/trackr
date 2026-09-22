import prisma from "@/lib/db";
import { ProjectPermission, ProjectRole, BuiltInRole } from "@/types";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import { getCurrentUser, SessionUser } from "@/lib/auth/session";
import { ensureInstanceAdminExists } from "@/lib/auth/instanceAdmin";

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

export function canUserCreateProjects(user: SessionUser | null | undefined): boolean {
  return !!user?.canCreateProjects;
}

export async function requireCanCreateProject(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.canCreateProjects) {
    throw new AuthError("You do not have permission to create projects.", 403);
  }
  return user;
}

/**
 * The caller's role on a project: ADMIN for the project lead, otherwise the
 * explicit membership role. Absence of a membership means no access, unless
 * the project publishes itself to anonymous viewers.
 */
export async function getProjectRole(
  userId: string | null,
  projectId: string
): Promise<ProjectRole | null> {
  const [project, member] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { leadId: true, allowAnonymousViewers: true },
    }),
    userId
      ? prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
          select: { role: true },
        })
      : Promise.resolve(null),
  ]);

  if (!project) return null;
  if (userId && project.leadId === userId) return "ADMIN";

  const membershipRole = member?.role as ProjectRole | undefined;
  if (membershipRole) return membershipRole;

  // Read-only fallback for a published project. VIEWER carries VIEW_PROJECT
  // alone, so this cannot grant a write to anyone.
  return project.allowAnonymousViewers ? "VIEWER" : null;
}

export interface ProjectAuth {
  /** Null only for an anonymous visitor reading a published project. */
  user: SessionUser | null;
  role: ProjectRole;
  projectId: string;
}

/** A ProjectAuth that is known to belong to a signed-in caller. */
export interface AuthenticatedProjectAuth extends ProjectAuth {
  user: SessionUser;
}

export async function checkProjectPermission(
  userId: string | null,
  projectId: string,
  permission: ProjectPermission
): Promise<{ allowed: boolean; role: ProjectRole | null }> {
  const [project, member] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { leadId: true, allowAnonymousViewers: true },
    }),
    userId
      ? prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
          include: { customRole: true },
        })
      : Promise.resolve(null),
  ]);

  if (!project) return { allowed: false, role: null };
  if (userId && project.leadId === userId) {
    return { allowed: true, role: "ADMIN" };
  }

  const role = (member?.role as ProjectRole) || (project.allowAnonymousViewers ? "VIEWER" : null);
  if (!role) return { allowed: false, role: null };

  if (role in ROLE_PERMISSIONS) {
    const allowed = (ROLE_PERMISSIONS[role as BuiltInRole] || []).includes(permission);
    return { allowed, role };
  }

  // Check custom role relation
  if (member?.customRole) {
    const perms: ProjectPermission[] = Array.isArray(member.customRole.permissions)
      ? member.customRole.permissions
      : typeof member.customRole.permissions === "string"
      ? JSON.parse(member.customRole.permissions || "[]")
      : [];
    return { allowed: perms.includes(permission), role };
  }

  // Fallback: look up custom role by name for this project
  const custom = await prisma.customRole.findFirst({
    where: { projectId, name: role },
  });
  if (custom) {
    const perms: ProjectPermission[] = typeof custom.permissions === "string"
      ? JSON.parse(custom.permissions || "[]")
      : [];
    return { allowed: perms.includes(permission), role };
  }

  return { allowed: false, role };
}

/**
 * Whether the caller may moderate other people's issues, comments,
 * attachments and logged work: the built-in Administrator (which includes the
 * project lead), or a custom role granted the Project Admin permission.
 */
export async function canModerateProject(auth: AuthenticatedProjectAuth): Promise<boolean> {
  if (auth.role === "ADMIN") return true;
  const { allowed } = await checkProjectPermission(auth.user.id, auth.projectId, "PROJECT_ADMIN");
  return allowed;
}

/**
 * Require a signed-in caller holding `permission` on `projectId`.
 *
 * Every write goes through here, so publishing a project to anonymous viewers
 * can never expose one: the session is demanded before the role is even
 * resolved, and a visitor is told to sign in rather than that they lack a role.
 */
export async function requireProjectPermission(
  projectId: string,
  permission: ProjectPermission
): Promise<AuthenticatedProjectAuth> {
  const user = await requireUser();
  const { allowed, role } = await checkProjectPermission(user.id, projectId, permission);

  if (!role) throw new AuthError(NO_ACCESS);
  if (!allowed) {
    throw new AuthError("Your project role does not allow this action.");
  }

  return { user, role, projectId };
}

/**
 * As `requireProjectPermission`, but does not insist on a session when the
 * project grants the permission to anonymous viewers. Read paths use this.
 */
export async function requireProjectPermissionAllowingAnonymous(
  projectId: string,
  permission: ProjectPermission
): Promise<ProjectAuth> {
  const user = await getCurrentUser();
  const { allowed, role } = await checkProjectPermission(user?.id ?? null, projectId, permission);

  if (!role) {
    throw new AuthError(user ? NO_ACCESS : NOT_SIGNED_IN, user ? 403 : 401);
  }
  if (!allowed) {
    throw new AuthError("Your project role does not allow this action.");
  }

  return { user, role, projectId };
}

/** Require read access to a project, which an anonymous visitor may hold. */
export function requireProjectAccess(projectId: string): Promise<ProjectAuth> {
  return requireProjectPermissionAllowingAnonymous(projectId, "VIEW_PROJECT");
}

/**
 * Non-throwing read check, for server components and list queries that should
 * render an empty state rather than an error.
 */
export async function canAccessProject(projectId: string): Promise<boolean> {
  const user = await getCurrentUser();
  const { allowed } = await checkProjectPermission(user?.id ?? null, projectId, "VIEW_PROJECT");
  return allowed;
}

/**
 * True when the caller belongs to the project in their own right, rather than
 * holding a role only because the project is published to anonymous viewers.
 *
 * Team contact details are gated on this, not on read access.
 */
export async function isProjectTeamMember(
  userId: string | null | undefined,
  projectId: string
): Promise<boolean> {
  if (!userId) return false;

  const [membership, project] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { userId: true },
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { leadId: true } }),
  ]);

  return !!membership || project?.leadId === userId;
}

/**
 * Instance-wide settings (SSO, global webhooks, system info, who may create
 * projects, who else is an instance admin) belong to instance admins alone.
 *
 * Deliberately not derived from project roles: SSO decides how every account
 * signs in, so anyone who could configure it could sign in as anyone. Being
 * trusted with one project must not confer that.
 */
export async function requireInstanceAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  await ensureInstanceAdminExists();

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isInstanceAdmin: true },
  });
  if (!row?.isInstanceAdmin) {
    throw new AuthError("Only an instance administrator can change instance settings.");
  }
  return user;
}

/** Non-throwing form of requireInstanceAdmin, for deciding what to show. */
export async function isCurrentUserInstanceAdmin(): Promise<boolean> {
  try {
    await requireInstanceAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthError) return false;
    throw error;
  }
}

/**
 * Project ids the caller belongs to in their own right, excluding projects they
 * can merely read because those are published. Contact details are gated on
 * this set.
 */
export async function teamProjectIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();

  const [led, memberships] = await Promise.all([
    prisma.project.findMany({ where: { leadId: userId }, select: { id: true } }),
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
  ]);

  return new Set([...led.map((p) => p.id), ...memberships.map((m) => m.projectId)]);
}

/**
 * Project ids the caller may read: those they lead or belong to, plus every
 * project published to anonymous viewers.
 */
export async function accessibleProjectIds(userId: string | null): Promise<string[]> {
  const [led, memberships, published] = await Promise.all([
    userId
      ? prisma.project.findMany({ where: { leadId: userId }, select: { id: true } })
      : Promise.resolve([]),
    userId
      ? prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { allowAnonymousViewers: true },
      select: { id: true },
    }),
  ]);

  return Array.from(
    new Set([
      ...led.map((p) => p.id),
      ...memberships.map((m) => m.projectId),
      ...published.map((p) => p.id),
    ])
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

export async function projectIdForWorkflowStatus(statusId: string): Promise<string> {
  const status = await prisma.workflowStatus.findUnique({
    where: { id: statusId },
    select: { projectId: true },
  });
  return projectIdOf(status, "Workflow status");
}

export async function projectIdForAttachment(attachmentId: string): Promise<string> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { issue: { select: { projectId: true } } },
  });
  return projectIdOf(attachment?.issue ?? null, "Attachment");
}

export async function projectIdForComponent(componentId: string): Promise<string> {
  const component = await prisma.component.findUnique({
    where: { id: componentId },
    select: { projectId: true },
  });
  return projectIdOf(component, "Component");
}

export async function projectIdForWorklog(worklogId: string): Promise<string> {
  const worklog = await prisma.worklog.findUnique({
    where: { id: worklogId },
    select: { issue: { select: { projectId: true } } },
  });
  return projectIdOf(worklog?.issue ?? null, "Worklog");
}
