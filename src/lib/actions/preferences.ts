"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

/** Turns the redesigned shell (rail, Home, Inbox) on or off for the caller. */
export async function setNewLayout(enabled: boolean) {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { useNewLayout: enabled === true },
    });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to change the layout preference:", error);
    return { success: false as const, error: "Couldn't change the layout. Try again." };
  }
}
