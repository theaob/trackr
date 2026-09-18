"use server";

import prisma from "@/lib/db";
import { projectIdForIssue, requireProjectPermission, toActionError } from "@/lib/auth/guards";

/** Whether the caller watches this issue, and who else does -- for the modal's toggle + count. */
export async function getWatchState(issueId: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "VIEW_PROJECT");

    const watchers = await prisma.watcher.findMany({
      where: { issueId },
      select: { userId: true },
    });

    return {
      watching: watchers.some((w) => w.userId === user.id),
      count: watchers.length,
    };
  } catch (error) {
    console.error("Failed to load watch state:", error);
    return { watching: false, count: 0 };
  }
}

export async function toggleWatch(issueId: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "VIEW_PROJECT");

    const existing = await prisma.watcher.findUnique({
      where: { issueId_userId: { issueId, userId: user.id } },
    });

    if (existing) {
      await prisma.watcher.delete({ where: { id: existing.id } });
      const count = await prisma.watcher.count({ where: { issueId } });
      return { success: true as const, watching: false, count };
    }

    await prisma.watcher.create({ data: { issueId, userId: user.id } });
    const count = await prisma.watcher.count({ where: { issueId } });
    return { success: true as const, watching: true, count };
  } catch (error) {
    return toActionError(error, "Failed to update watch status");
  }
}
