import prisma from "@/lib/db";

/**
 * Notify everyone watching an issue, other than whoever is already being
 * notified some other way (the actor, the assignee, an @mentioned user...).
 * Callers pass those ids in `exclude` rather than this function guessing.
 *
 * Deliberately NOT exported from a "use server" action file: it has no auth
 * check of its own, so it must only ever run as part of an action that has
 * already verified the caller's permission on this issue.
 */
export async function notifyWatchers(
  issueId: string,
  exclude: Array<string | null | undefined>,
  title: string,
  message: string,
  link: string
) {
  const excludeIds = Array.from(new Set(exclude.filter((id): id is string => !!id)));

  const watchers = await prisma.watcher.findMany({
    where: {
      issueId,
      ...(excludeIds.length > 0 && { userId: { notIn: excludeIds } }),
    },
    select: { userId: true },
  });

  if (watchers.length === 0) return;

  await prisma.notification.createMany({
    data: watchers.map((w) => ({ userId: w.userId, title, message, link })),
  });
}
