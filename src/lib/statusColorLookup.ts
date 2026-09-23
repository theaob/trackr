import prisma from "@/lib/db";

/**
 * Attach each issue's status color from its own project's workflow. Status
 * lozenges otherwise color by name from the project being viewed, which is
 * wrong for a linked issue that lives in another project.
 */
export async function attachStatusColors<T extends { projectId: string; status: string }>(
  issues: T[]
): Promise<Array<T & { statusColor?: string }>> {
  if (issues.length === 0) return issues;
  const projectIds = Array.from(new Set(issues.map((i) => i.projectId)));
  const statuses = await prisma.workflowStatus.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, name: true, color: true },
  });
  const colorOf = new Map(statuses.map((s) => [`${s.projectId}\u0000${s.name}`, s.color]));
  return issues.map((issue) => {
    const statusColor = colorOf.get(`${issue.projectId}\u0000${issue.status}`);
    return statusColor ? { ...issue, statusColor } : issue;
  });
}
