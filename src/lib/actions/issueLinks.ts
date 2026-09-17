"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import {
  accessibleProjectIds,
  canAccessProject,
  projectIdForIssue,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ISSUE_LINK_TYPES,
  IssueLinkType,
  describeIssueLink,
  isSymmetricLinkType,
} from "@/lib/issueLinks";

const LINKED_ISSUE_SELECT = {
  id: true,
  key: true,
  title: true,
  type: true,
  status: true,
  projectId: true,
  project: { select: { key: true, name: true } },
} as const;

/**
 * Candidates for the "link an issue" picker: issues in projects the caller
 * can see, matching the query by key or title, excluding the issue itself and
 * anything it is already linked to (either direction).
 */
export async function searchLinkableIssues(issueId: string, query: string) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const user = await getCurrentUser();
    const projectIds = await accessibleProjectIds(user?.id ?? null);
    if (projectIds.length === 0) return [];

    const [asSource, asTarget] = await Promise.all([
      prisma.issueLink.findMany({ where: { sourceId: issueId }, select: { targetId: true } }),
      prisma.issueLink.findMany({ where: { targetId: issueId }, select: { sourceId: true } }),
    ]);
    const excludeIds = [
      issueId,
      ...asSource.map((l) => l.targetId),
      ...asTarget.map((l) => l.sourceId),
    ];

    return await prisma.issue.findMany({
      where: {
        projectId: { in: projectIds },
        id: { notIn: excludeIds },
        OR: [{ key: { contains: trimmed } }, { title: { contains: trimmed } }],
      },
      select: LINKED_ISSUE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  } catch (error) {
    console.error("Failed to search linkable issues:", error);
    return [];
  }
}

export async function createIssueLink(data: {
  issueId: string;
  targetIssueId: string;
  type: IssueLinkType;
}) {
  try {
    if (!ISSUE_LINK_TYPES.includes(data.type)) {
      return { success: false as const, error: "Unknown link type." };
    }
    if (data.issueId === data.targetIssueId) {
      return { success: false as const, error: "An issue cannot link to itself." };
    }

    const projectId = await projectIdForIssue(data.issueId);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const [source, target] = await Promise.all([
      prisma.issue.findUnique({ where: { id: data.issueId }, select: LINKED_ISSUE_SELECT }),
      prisma.issue.findUnique({ where: { id: data.targetIssueId }, select: LINKED_ISSUE_SELECT }),
    ]);
    if (!source) throw new Error("Issue not found");
    if (!target) return { success: false as const, error: "Target issue not found." };

    if (!(await canAccessProject(target.projectId))) {
      return { success: false as const, error: "You do not have access to that issue." };
    }

    // A symmetric type reads the same from either side, so a reversed pair
    // would just be a redundant second row for the same relationship.
    const duplicate = await prisma.issueLink.findFirst({
      where: isSymmetricLinkType(data.type)
        ? {
            type: data.type,
            OR: [
              { sourceId: data.issueId, targetId: data.targetIssueId },
              { sourceId: data.targetIssueId, targetId: data.issueId },
            ],
          }
        : { type: data.type, sourceId: data.issueId, targetId: data.targetIssueId },
    });
    if (duplicate) {
      return {
        success: false as const,
        error: `These issues already have that link (${describeIssueLink(data.type, "outward")}).`,
      };
    }

    const link = await prisma.issueLink.create({
      data: { type: data.type, sourceId: data.issueId, targetId: data.targetIssueId },
    });

    await prisma.activityLog.createMany({
      data: [
        {
          issueId: source.id,
          userId: user.id,
          action: "LINKED",
          field: "link",
          newValue: `${describeIssueLink(data.type, "outward")} ${target.key}`,
        },
        {
          issueId: target.id,
          userId: user.id,
          action: "LINKED",
          field: "link",
          newValue: `${describeIssueLink(data.type, "inward")} ${source.key}`,
        },
      ],
    });

    try {
      revalidatePath(`/projects/${source.project?.key}`);
      if (target.projectId !== source.projectId) revalidatePath(`/projects/${target.project?.key}`);
    } catch {}
    triggerWebhooks("issue:linked", { link, source, target }, source.projectId);

    return { success: true as const, link: { ...link, source, target } };
  } catch (error) {
    return toActionError(error, "Failed to link issue");
  }
}

export async function deleteIssueLink(linkId: string) {
  try {
    const link = await prisma.issueLink.findUnique({
      where: { id: linkId },
      include: { source: { select: LINKED_ISSUE_SELECT }, target: { select: LINKED_ISSUE_SELECT } },
    });
    if (!link) return { success: false as const, error: "Link not found." };

    // Either side's editor may remove the relationship.
    let actorId: string;
    try {
      actorId = (await requireProjectPermission(link.source.projectId, "EDIT_ISSUE")).user.id;
    } catch (firstError) {
      if (link.source.projectId === link.target.projectId) throw firstError;
      actorId = (await requireProjectPermission(link.target.projectId, "EDIT_ISSUE")).user.id;
    }

    await prisma.issueLink.delete({ where: { id: linkId } });

    await prisma.activityLog.createMany({
      data: [
        {
          issueId: link.source.id,
          userId: actorId,
          action: "UNLINKED",
          field: "link",
          // The history tab only ever renders newValue, so the removed
          // relationship goes there rather than in oldValue.
          newValue: `${describeIssueLink(link.type, "outward")} ${link.target.key}`,
        },
        {
          issueId: link.target.id,
          userId: actorId,
          action: "UNLINKED",
          field: "link",
          newValue: `${describeIssueLink(link.type, "inward")} ${link.source.key}`,
        },
      ],
    });

    try {
      revalidatePath(`/projects/${link.source.project?.key}`);
      if (link.target.projectId !== link.source.projectId) {
        revalidatePath(`/projects/${link.target.project?.key}`);
      }
    } catch {}
    triggerWebhooks("issue:unlinked", { link }, link.source.projectId);

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to remove link");
  }
}
