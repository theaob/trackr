"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PUBLIC_USER_SELECT } from "@/lib/auth/publicUser";
import { AuthError, requireInstanceAdmin, toActionError } from "@/lib/auth/guards";

/** Every account with its instance-level permissions, for the Users settings tab. */
export async function getInstanceUsers() {
  try {
    await requireInstanceAdmin();
    return await prisma.user.findMany({
      select: { ...PUBLIC_USER_SELECT, isInstanceAdmin: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("Failed to fetch instance users:", error);
    return [];
  }
}

export async function setUserInstanceAdmin(userId: string, isInstanceAdmin: boolean) {
  try {
    await requireInstanceAdmin();

    await prisma.$transaction(async (tx) => {
      if (!isInstanceAdmin) {
        const others = await tx.user.count({
          where: { isInstanceAdmin: true, id: { not: userId } },
        });
        if (others === 0) {
          throw new AuthError("There must always be at least one instance administrator.", 409);
        }
      }
      await tx.user.update({ where: { id: userId }, data: { isInstanceAdmin } });
    });

    try {
      revalidatePath("/settings");
      revalidatePath("/", "layout");
    } catch {}

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to update instance administrator");
  }
}
