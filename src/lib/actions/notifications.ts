"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getUserNotifications(userId: string) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
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
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return { success: true, notification: updated };
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return { success: false, error: "Failed to update notification" };
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return { success: false, error: "Failed to update notifications" };
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        link: link || null,
      },
    });
    return { success: true, notification };
  } catch (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}
