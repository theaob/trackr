import prisma from "@/lib/db";

export type WorkflowStatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

export const WORKFLOW_STATUS_CATEGORIES: WorkflowStatusCategory[] = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
];

interface DefaultStatusSeed {
  name: string;
  category: WorkflowStatusCategory;
  isBacklog: boolean;
  color: string;
  order: number;
  wipLimit: number | null;
}

/**
 * The workflow every project had before workflows were configurable. Status
 * names match the literal strings issues have always stored ("BACKLOG",
 * "TODO", ...) so an unedited project's issues keep matching without a data
 * migration; a custom status added later just uses whatever name its creator
 * picks.
 */
export const DEFAULT_WORKFLOW_STATUSES: DefaultStatusSeed[] = [
  { name: "BACKLOG", category: "TODO", isBacklog: true, color: "#94A3B8", order: 0, wipLimit: null },
  { name: "TODO", category: "TODO", isBacklog: false, color: "#64748B", order: 1, wipLimit: null },
  { name: "IN_PROGRESS", category: "IN_PROGRESS", isBacklog: false, color: "#2563EB", order: 2, wipLimit: 4 },
  { name: "IN_REVIEW", category: "IN_PROGRESS", isBacklog: false, color: "#7C3AED", order: 3, wipLimit: 3 },
  { name: "DONE", category: "DONE", isBacklog: false, color: "#059669", order: 4, wipLimit: null },
];

type WorkflowWriteClient = {
  workflowStatus: {
    create: (args: any) => Promise<{ id: string }>;
  };
  workflowTransition: {
    createMany: (args: any) => Promise<unknown>;
  };
};

/**
 * Insert the default statuses and a fully-connected transition graph (every
 * status can move to every other one) for a project that has none yet. Fully
 * connected because that is what "no workflow configured" has always behaved
 * like -- any status to any other -- so seeding it is invisible until an
 * admin actually edits the workflow.
 */
export async function seedDefaultWorkflow(client: WorkflowWriteClient, projectId: string) {
  const created: (DefaultStatusSeed & { id: string; projectId: string })[] = [];
  for (const seed of DEFAULT_WORKFLOW_STATUSES) {
    const status = await client.workflowStatus.create({
      data: {
        projectId,
        name: seed.name,
        category: seed.category,
        isBacklog: seed.isBacklog,
        color: seed.color,
        order: seed.order,
        wipLimit: seed.wipLimit,
      },
    });
    created.push({ ...seed, id: status.id, projectId });
  }

  const transitions: { projectId: string; fromId: string; toId: string }[] = [];
  for (const from of created) {
    for (const to of created) {
      if (from.id === to.id) continue;
      transitions.push({ projectId, fromId: from.id, toId: to.id });
    }
  }
  if (transitions.length > 0) {
    await client.workflowTransition.createMany({ data: transitions });
  }

  return created;
}

/**
 * Give a project a workflow when it has none, so reads never see an empty
 * status list. Not a server action -- nothing reachable from a browser should
 * seed workflow data on a project it doesn't otherwise administer.
 */
export async function ensureProjectWorkflowSeeded(projectId: string): Promise<void> {
  try {
    const count = await prisma.workflowStatus.count({ where: { projectId } });
    if (count > 0) return;

    await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: SQLite serializes writers, but a
      // concurrent caller could have already won between the count above and
      // here.
      const recheck = await tx.workflowStatus.count({ where: { projectId } });
      if (recheck > 0) return;
      await seedDefaultWorkflow(tx, projectId);
    });
  } catch (error) {
    console.error("Failed to seed default workflow:", error);
  }
}

/** A project's statuses, ordered for display, seeding the defaults first if needed. */
export async function getWorkflowStatuses(projectId: string) {
  await ensureProjectWorkflowSeeded(projectId);
  return prisma.workflowStatus.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });
}

/** Status names excluded from the board and shown in the Backlog view instead. */
export async function getBacklogStatusNames(projectId: string): Promise<string[]> {
  const statuses = await getWorkflowStatuses(projectId);
  return statuses.filter((s) => s.isBacklog).map((s) => s.name);
}

/** Status names in the "Done" category, for sprint/version completion math. */
export async function getDoneStatusNames(projectId: string): Promise<string[]> {
  const statuses = await getWorkflowStatuses(projectId);
  const doneNames = statuses.filter((s) => s.category === "DONE").map((s) => s.name);
  if (doneNames.length > 0) return doneNames;
  return ["DONE", "Done", "CLOSED", "RESOLVED"];
}

/** The status a new issue starts in: the first non-backlog status, in order. */
export async function getInitialStatusName(projectId: string): Promise<string> {
  const statuses = await getWorkflowStatuses(projectId);
  return (statuses.find((s) => !s.isBacklog) ?? statuses[0])?.name ?? "TODO";
}

/** The status an issue reverts to when pulled out of a sprint back to the backlog. */
export async function getPrimaryBacklogStatusName(projectId: string): Promise<string> {
  const statuses = await getWorkflowStatuses(projectId);
  return (statuses.find((s) => s.isBacklog) ?? statuses[0])?.name ?? "BACKLOG";
}

/** Status name -> category, for classifying issues without a query per issue. */
export async function getStatusCategoryMap(
  projectId: string
): Promise<Map<string, WorkflowStatusCategory>> {
  const statuses = await getWorkflowStatuses(projectId);
  return new Map(statuses.map((s) => [s.name, s.category as WorkflowStatusCategory]));
}

/**
 * Whether the project's workflow has a transition from `fromName` to
 * `toName`. Ensures default workflow is seeded if not present, and supports
 * case-insensitive status matching.
 */
export async function isTransitionAllowed(
  projectId: string,
  fromName: string,
  toName: string
): Promise<boolean> {
  if (!fromName || !toName) return false;
  if (fromName.trim().toUpperCase() === toName.trim().toUpperCase()) return true;

  await ensureProjectWorkflowSeeded(projectId);

  const statuses = await prisma.workflowStatus.findMany({
    where: { projectId },
    select: { id: true, name: true },
  });

  if (statuses.length === 0) {
    return true;
  }

  const normFrom = fromName.trim().toUpperCase();
  const normTo = toName.trim().toUpperCase();

  const fromStatus =
    statuses.find((s) => s.name === fromName) ??
    statuses.find((s) => s.name.trim().toUpperCase() === normFrom);

  const toStatus =
    statuses.find((s) => s.name === toName) ??
    statuses.find((s) => s.name.trim().toUpperCase() === normTo);

  // If either status is not found in workflowStatus table:
  if (!fromStatus || !toStatus) {
    // Fallback: If both are standard known statuses, allow the transition
    const standardStatuses = new Set([
      "BACKLOG",
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ]);
    if (standardStatuses.has(normFrom) && standardStatuses.has(normTo)) {
      return true;
    }
    return false;
  }

  // Check if transitions exist for this project
  const transitionCount = await prisma.workflowTransition.count({
    where: { projectId },
  });

  // If no transitions configured at all in the project, allow any transition
  if (transitionCount === 0) {
    return true;
  }

  const transition = await prisma.workflowTransition.findUnique({
    where: { fromId_toId: { fromId: fromStatus.id, toId: toStatus.id } },
    select: { id: true },
  });
  return !!transition;
}
