"use server";

import { addDays } from "date-fns";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { accessibleProjectIds } from "@/lib/auth/guards";
import { attachStatusColors } from "@/lib/statusColorLookup";

export interface HomeIssue {
  id: string;
  key: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  statusColor?: string;
  dueDate: string | null;
  projectKey: string;
  projectName: string;
}

export interface HomeData {
  /** Open issues assigned to the caller, most recently updated first. */
  assigned: HomeIssue[];
  /** How many open issues are assigned in all, when `assigned` is cut short. */
  assignedTotal: number;
  /** Open, assigned, and due within about a week or already late. */
  dueSoon: HomeIssue[];
}

const ASSIGNED_LIMIT = 25;

/**
 * Where the caller's open work is: assigned to them, in a project they can
 * still read, and not in a done-category status of that project's workflow.
 */
async function openAssignedWhere(userId: string) {
  const projectIds = await accessibleProjectIds(userId);
  if (projectIds.length === 0) return null;

  const doneStatuses = await prisma.workflowStatus.findMany({
    where: { projectId: { in: projectIds }, category: "DONE" },
    select: { projectId: true, name: true },
  });
  const doneByProject = new Map<string, string[]>();
  for (const s of doneStatuses) doneByProject.set(s.projectId, [...(doneByProject.get(s.projectId) ?? []), s.name]);

  return {
    assigneeId: userId,
    // A project without a configured workflow still uses the built-in "DONE".
    OR: projectIds.map((projectId) => ({
      projectId,
      status: { notIn: doneByProject.get(projectId) ?? ["DONE"] },
    })),
  };
}

/** The number beside Home in the rail. 0 when signed out. */
export async function getMyOpenIssueCount(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;
    const where = await openAssignedWhere(user.id);
    return where ? await prisma.issue.count({ where }) : 0;
  } catch (error) {
    console.error("Failed to count open issues:", error);
    return 0;
  }
}

export async function getHomeData(): Promise<HomeData> {
  const empty: HomeData = { assigned: [], assignedTotal: 0, dueSoon: [] };
  try {
    const user = await getCurrentUser();
    if (!user) return empty;
    const where = await openAssignedWhere(user.id);
    if (!where) return empty;

    const select = {
      id: true,
      key: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      dueDate: true,
      projectId: true,
      project: { select: { key: true, name: true } },
    } as const;

    // Due dates are calendar days stored at midnight UTC; a day's slack
    // either side of the week lets the viewer's own time zone decide.
    const [assigned, assignedTotal, dueSoon] = await Promise.all([
      prisma.issue.findMany({ where, select, orderBy: { updatedAt: "desc" }, take: ASSIGNED_LIMIT }),
      prisma.issue.count({ where }),
      prisma.issue.findMany({
        where: { AND: [where, { dueDate: { not: null, lte: addDays(new Date(), 8) } }] },
        select,
        orderBy: { dueDate: "asc" },
        take: 50,
      }),
    ]);

    const toHome = async (issues: typeof assigned): Promise<HomeIssue[]> =>
      (await attachStatusColors(issues)).map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        status: issue.status,
        statusColor: issue.statusColor,
        dueDate: issue.dueDate ? issue.dueDate.toISOString() : null,
        projectKey: issue.project.key,
        projectName: issue.project.name,
      }));

    return { assigned: await toHome(assigned), assignedTotal, dueSoon: await toHome(dueSoon) };
  } catch (error) {
    console.error("Failed to load Home:", error);
    return empty;
  }
}
