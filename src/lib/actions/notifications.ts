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

const INBOX_PAGE = 30;

/**
 * A page of the Inbox, newest first. Pass the last id of the previous page as
 * `cursor` for the next one; `nextCursor` is null at the end.
 */
export async function getInboxNotifications(options: { cursor?: string | null; unreadOnly?: boolean } = {}) {
  try {
    const user = await requireUser();
    const cursor = typeof options.cursor === "string" && options.cursor ? options.cursor : null;
    const rows = await prisma.notification.findMany({
      where: { userId: user.id, ...(options.unreadOnly ? { read: false } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: INBOX_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, INBOX_PAGE);
    return { items, nextCursor: rows.length > INBOX_PAGE ? items[items.length - 1].id : null };
  } catch (error) {
    console.error("Failed to load the inbox:", error);
    return { items: [], nextCursor: null };
  }
}

/** Every unread notification, not just those in the latest page. */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const user = await requireUser();
    return await prisma.notification.count({ where: { userId: user.id, read: false } });
  } catch {
    return 0;
  }
}
