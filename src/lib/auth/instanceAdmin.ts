import prisma from "@/lib/db";

let confirmed = false;

/**
 * Installs that predate `isInstanceAdmin` have nobody holding it, which would
 * lock everyone out of instance settings. Promote the instance's original
 * owner once: the oldest account allowed to create projects (the /setup
 * account, or the first demo user), else the oldest account. The choice
 * depends only on stored data, never on who happens to trigger it, and later
 * accounts can't displace the original owner.
 */
export async function ensureInstanceAdminExists(): Promise<void> {
  if (confirmed) return;

  const admins = await prisma.user.count({ where: { isInstanceAdmin: true } });
  if (admins === 0) {
    const owner =
      (await prisma.user.findFirst({
        where: { canCreateProjects: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      })) ??
      (await prisma.user.findFirst({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      }));

    if (!owner) return; // Fresh install: /setup will create the owner.

    await prisma.user.update({ where: { id: owner.id }, data: { isInstanceAdmin: true } });
  }

  confirmed = true;
}
