import prisma from "@/lib/db";
import { prettifyStatusName } from "@/lib/workflowDisplay";

/**
 * Every in-app notification about an issue goes through here, so the rule
 * about who may receive one lives in one place: only people who can still
 * see the project. Someone removed from a project, or a visitor who watched
 * an issue while the project was published, stops hearing about it.
 */

export interface NotificationContent {
  title: string;
  message: string;
  link: string;
}

type MaybeId = string | null | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Notifications are never deleted by anyone, so trim as new ones arrive: read
 * ones after 90 days, and anything after a year.
 */
async function pruneNotifications(userIds: string[]) {
  const now = Date.now();
  try {
    await prisma.notification.deleteMany({
      where: {
        userId: { in: userIds },
        OR: [
          { read: true, createdAt: { lt: new Date(now - 90 * DAY_MS) } },
          { createdAt: { lt: new Date(now - 365 * DAY_MS) } },
        ],
      },
    });
  } catch (error) {
    console.error("Failed to prune notifications:", error);
  }
}

/** Of these users, the ones who can currently see the project. */
async function withProjectAccess(projectId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leadId: true, allowAnonymousViewers: true },
  });
  if (!project) return [];
  // A published project is readable by anyone, members or not.
  if (project.allowAnonymousViewers) return userIds;

  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: userIds } },
    select: { userId: true },
  });
  const allowed = new Set(members.map((m) => m.userId));
  if (project.leadId) allowed.add(project.leadId);
  return userIds.filter((id) => allowed.has(id));
}

/**
 * Notify each of these users once, skipping `exclude` (usually whoever made
 * the change) and anyone who can no longer see the project.
 */
export async function notifyUsers(
  projectId: string,
  recipients: MaybeId[],
  content: NotificationContent,
  exclude: MaybeId[] = []
): Promise<string[]> {
  const skip = new Set(exclude.filter((id): id is string => !!id));
  const candidates = Array.from(
    new Set(recipients.filter((id): id is string => !!id && !skip.has(id)))
  );
  const userIds = await withProjectAccess(projectId, candidates);
  if (userIds.length > 0) {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, ...content })),
    });
    await pruneNotifications(userIds);
  }
  return userIds;
}

/** Notify an issue's watchers, except `exclude`. */
export async function notifyWatchers(
  issueId: string,
  exclude: MaybeId[],
  title: string,
  message: string,
  link: string
) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true, watchers: { select: { userId: true } } },
  });
  if (!issue) return;
  await notifyUsers(
    issue.projectId,
    issue.watchers.map((w) => w.userId),
    { title, message, link },
    exclude
  );
}

export function issueLink(projectKey: string, issueKey: string): string {
  return `/projects/${projectKey}/board?selectedIssue=${issueKey}`;
}

/**
 * Tell an issue's assignee and watchers that its status changed. Every path
 * that changes a status calls this: the issue's own status field, a board
 * drag, moving between backlog and sprint, and completing or deleting a sprint.
 */
export async function notifyStatusChange(params: {
  issue: { id: string; key: string; projectId: string; assigneeId: string | null };
  projectKey: string;
  from: string;
  to: string;
  actorId: string | null;
}) {
  const { issue, projectKey, from, to, actorId } = params;
  const issueWithWatchers = await prisma.issue.findUnique({
    where: { id: issue.id },
    select: { watchers: { select: { userId: true } } },
  });
  await notifyUsers(
    issue.projectId,
    [issue.assigneeId, ...(issueWithWatchers?.watchers.map((w) => w.userId) ?? [])],
    {
      title: `${issue.key} moved to ${prettifyStatusName(to)}`,
      message: `Status changed from ${prettifyStatusName(from)} to ${prettifyStatusName(to)}`,
      link: issueLink(projectKey, issue.key),
    },
    [actorId]
  );
}
