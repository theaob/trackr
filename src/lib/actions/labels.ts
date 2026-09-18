"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  projectIdForIssue,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { isValidLabelName, normalizeLabelName } from "@/lib/labels";

async function revalidateProject(projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
    if (project) revalidatePath(`/projects/${project.key}`);
  } catch {}
}

/** A project's labels, for the autocomplete list -- every label ever used, not just ones currently attached. */
export async function getProjectLabels(projectId: string) {
  try {
    await requireProjectAccess(projectId);
    return await prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch project labels:", error);
    return [];
  }
}

export async function addIssueLabel(issueId: string, rawName: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const name = normalizeLabelName(rawName);
    if (!isValidLabelName(name)) {
      return { success: false as const, error: "Labels can't be empty or contain spaces." };
    }

    const label = await prisma.label.upsert({
      where: { projectId_name: { projectId, name } },
      create: { projectId, name },
      update: {},
    });

    const existing = await prisma.issueLabel.findUnique({
      where: { issueId_labelId: { issueId, labelId: label.id } },
    });
    if (existing) {
      return { success: true as const, issueLabel: { ...existing, label } };
    }

    const issueLabel = await prisma.issueLabel.create({
      data: { issueId, labelId: label.id },
    });

    const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { key: true } });
    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "LABEL_ADDED",
        field: "labels",
        newValue: name,
      },
    });

    await revalidateProject(projectId);
    return { success: true as const, issueLabel: { ...issueLabel, label }, issueKey: issue?.key };
  } catch (error) {
    return toActionError(error, "Failed to add label");
  }
}

const MAX_BULK_BATCH = 200;

/** Attaches one label (find-or-create) to many issues at once, e.g. from the Issues list's bulk toolbar. */
export async function bulkAddLabel(issueIds: string[], rawName: string) {
  const ids = Array.from(new Set(issueIds));
  if (ids.length === 0) return { success: true as const, succeeded: 0, failed: [] as { id: string; error: string }[] };
  if (ids.length > MAX_BULK_BATCH) {
    return { success: false as const, error: `Select at most ${MAX_BULK_BATCH} issues at a time.` };
  }

  const failed: { id: string; error: string }[] = [];
  let succeeded = 0;

  for (const id of ids) {
    const res = await addIssueLabel(id, rawName);
    if (res.success) {
      succeeded++;
    } else {
      failed.push({ id, error: res.error || "Failed to add label" });
    }
  }

  return { success: true as const, succeeded, failed };
}

export async function removeIssueLabel(issueId: string, labelId: string) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const issueLabel = await prisma.issueLabel.findUnique({
      where: { issueId_labelId: { issueId, labelId } },
      include: { label: true },
    });
    if (!issueLabel) return { success: true as const };

    await prisma.issueLabel.delete({ where: { id: issueLabel.id } });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "LABEL_REMOVED",
        field: "labels",
        newValue: issueLabel.label.name,
      },
    });

    await revalidateProject(projectId);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to remove label");
  }
}
