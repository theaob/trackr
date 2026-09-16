"use server";

import prisma from "@/lib/db";
import { requireUser, toActionError } from "@/lib/auth/guards";

/**
 * Notifications belong to the signed-in user.
 *
 * Every entry point below ignores any caller-supplied user id and scopes the
 * query to the session, so one account can never read or clear another's.
 */
export async function getUserNotifications(_userId?: string) {
  try {
    const user = await requireUser();
    return await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    const user = await requireUser();

    // Scoped update: a notification belonging to someone else matches nothing.
    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });

    if (result.count === 0) {
      return { success: false as const, error: "Notification not found" };
    }

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to update notification");
  }
}

export async function markAllNotificationsAsRead(_userId?: string) {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to update notifications");
  }
}
