"use server";

import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { accessibleProjectIds, checkProjectPermission } from "@/lib/auth/guards";
import { allowedNextStatusNames } from "@/lib/workflowDisplay";
import { attachStatusColors } from "@/lib/statusColorLookup";
import {
  SPOTLIGHT_MAX_QUERY,
  SpotlightIssue,
  SpotlightProject,
  issueKeyForQuery,
  matchesEveryWord,
  rankIssueMatches,
} from "@/lib/spotlight";

const RESULTS = 8;

/** The projects the ⌘K panel can jump to: the ones the caller can read. */
export async function getSpotlightProjects(): Promise<SpotlightProject[]> {
  try {
    const user = await getCurrentUser();
    const ids = await accessibleProjectIds(user?.id ?? null);
    if (ids.length === 0) return [];
    return await prisma.project.findMany({
      where: { id: { in: ids } },
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to load projects for search:", error);
    return [];
  }
}

/**
 * Issues for the ⌘K panel, from every project the caller can read. Each word
 * must appear in the key or the title. A query that names a key ("APOLLO-3",
 * or "3" while viewing Apollo) always puts that issue first.
 */
export async function searchSpotlightIssues(
  query: string,
  currentProjectKey?: string | null
): Promise<SpotlightIssue[]> {
  const q = typeof query === "string" ? query.trim().slice(0, SPOTLIGHT_MAX_QUERY) : "";
  if (!q) return [];

  try {
    const user = await getCurrentUser();
    const projectIds = await accessibleProjectIds(user?.id ?? null);
    if (projectIds.length === 0) return [];

    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const exactKey = issueKeyForQuery(q, currentProjectKey);
    const select = {
      id: true,
      key: true,
      title: true,
      type: true,
      status: true,
      projectId: true,
      project: { select: { key: true, name: true } },
    } as const;

    const [matches, exact] = await Promise.all([
      prisma.issue.findMany({
        where: {
          projectId: { in: projectIds },
          AND: words.map((word) => ({
            OR: [{ key: { contains: word } }, { title: { contains: word } }],
          })),
        },
        select,
        orderBy: { updatedAt: "desc" },
        // Headroom for LIKE's wildcard matches, which are dropped below.
        take: 40,
      }),
      exactKey
        ? prisma.issue.findFirst({ where: { key: exactKey, projectId: { in: projectIds } }, select })
        : Promise.resolve(null),
    ]);

    const literal = matches.filter((issue) => matchesEveryWord(issue, q));
    const candidates = exact && !literal.some((m) => m.id === exact.id) ? [exact, ...literal] : literal;
    const top = rankIssueMatches(q, candidates, currentProjectKey).slice(0, RESULTS);
    const colored = await attachStatusColors(top);
    return colored.map((issue) => ({
      id: issue.id,
      key: issue.key,
      title: issue.title,
      type: issue.type,
      status: issue.status,
      statusColor: issue.statusColor,
      projectKey: issue.project.key,
      projectName: issue.project.name,
    }));
  } catch (error) {
    console.error("Failed to search issues:", error);
    return [];
  }
}

export interface SpotlightIssueActions {
  id: string;
  key: string;
  title: string;
  status: string;
  projectKey: string;
  assignedToMe: boolean;
  /** Whether the caller may edit it; assign and move are offered only then. */
  canEdit: boolean;
  /** Statuses the workflow allows moving to from the current one. */
  moves: { name: string; color: string }[];
}

/**
 * What ⌘K search can do to one issue, for its actions list. Null when the
 * caller can't see the issue. The actions themselves go through updateIssue,
 * which checks permission and the workflow again.
 */
export async function getSpotlightIssueActions(issueKey: string): Promise<SpotlightIssueActions | null> {
  if (typeof issueKey !== "string" || !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(issueKey)) return null;
  try {
    const user = await getCurrentUser();
    const projectIds = await accessibleProjectIds(user?.id ?? null);
    if (projectIds.length === 0) return null;

    const issue = await prisma.issue.findFirst({
      where: { key: issueKey.toUpperCase(), projectId: { in: projectIds } },
      select: { id: true, key: true, title: true, status: true, projectId: true, assigneeId: true, project: { select: { key: true } } },
    });
    if (!issue) return null;

    const canEdit = user ? (await checkProjectPermission(user.id, issue.projectId, "EDIT_ISSUE")).allowed : false;
    let moves: { name: string; color: string }[] = [];
    if (canEdit) {
      const [statuses, transitions] = await Promise.all([
        prisma.workflowStatus.findMany({
          where: { projectId: issue.projectId },
          select: { id: true, name: true, color: true },
          orderBy: { order: "asc" },
        }),
        prisma.workflowTransition.findMany({ where: { projectId: issue.projectId }, select: { fromId: true, toId: true } }),
      ]);
      const allowed = new Set(allowedNextStatusNames(issue.status, statuses, transitions));
      moves = statuses.filter((s) => allowed.has(s.name) && s.name !== issue.status).map((s) => ({ name: s.name, color: s.color }));
    }

    return {
      id: issue.id,
      key: issue.key,
      title: issue.title,
      status: issue.status,
      projectKey: issue.project.key,
      assignedToMe: !!user && issue.assigneeId === user.id,
      canEdit,
      moves,
    };
  } catch (error) {
    console.error("Failed to load issue actions:", error);
    return null;
  }
}
