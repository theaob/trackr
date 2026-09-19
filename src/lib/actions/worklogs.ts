"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import {
  projectIdForIssue,
  projectIdForWorklog,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import { formatDuration } from "@/lib/duration";

export async function logWork(
  issueId: string,
  data: { timeSpentSeconds: number; description?: string; workDate?: string | Date }
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "ADD_COMMENT");

    if (!Number.isFinite(data.timeSpentSeconds) || data.timeSpentSeconds <= 0) {
      return { success: false as const, error: "Enter how much time was spent." };
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue) throw new Error("Issue not found");

    const worklog = await prisma.worklog.create({
      data: {
        issueId,
        authorId: user.id,
        timeSpentSeconds: Math.round(data.timeSpentSeconds),
        description: data.description?.trim() || null,
        workDate: data.workDate ? new Date(data.workDate) : new Date(),
      },
      include: { author: { select: DISPLAY_USER_SELECT } },
    });

    // Mirrors Jira's default: reduce the remaining estimate by what was just
    // logged, auto-initializing it from the original estimate on the first
    // log. An issue with no estimate at all stays untracked (null).
    const baseRemaining = issue.remainingEstimateSeconds ?? issue.originalEstimateSeconds ?? null;
    let remainingEstimateSeconds = issue.remainingEstimateSeconds;
    if (baseRemaining !== null) {
      remainingEstimateSeconds = Math.max(0, baseRemaining - worklog.timeSpentSeconds);
      await prisma.issue.update({
        where: { id: issueId },
        data: { remainingEstimateSeconds },
      });
    }

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "LOGGED_WORK",
        field: "worklog",
        newValue: formatDuration(worklog.timeSpentSeconds),
      },
    });

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}

    triggerWebhooks(
      "worklog:created",
      {
        worklog,
        issue: { id: issue.id, key: issue.key, title: issue.title },
        remainingEstimateSeconds,
      },
      issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: issue.id,
      }
    );

    return { success: true as const, worklog, remainingEstimateSeconds };
  } catch (error) {
    return toActionError(error, "Failed to log work");
  }
}

export async function deleteWorklog(worklogId: string) {
  try {
    const projectId = await projectIdForWorklog(worklogId);
    const { user, role } = await requireProjectPermission(projectId, "VIEW_PROJECT");

    const worklog = await prisma.worklog.findUnique({
      where: { id: worklogId },
      include: { issue: { include: { project: true } } },
    });
    if (!worklog) throw new Error("Worklog not found");

    // A worklog belongs to its author; project administrators can moderate.
    if (worklog.authorId !== user.id && role !== "ADMIN") {
      return { success: false as const, error: "You can only delete your own logged work." };
    }

    await prisma.worklog.delete({ where: { id: worklogId } });

    let remainingEstimateSeconds = worklog.issue.remainingEstimateSeconds;
    if (remainingEstimateSeconds !== null) {
      remainingEstimateSeconds = remainingEstimateSeconds + worklog.timeSpentSeconds;
      await prisma.issue.update({
        where: { id: worklog.issueId },
        data: { remainingEstimateSeconds },
      });
    }

    try {
      revalidatePath(`/projects/${worklog.issue.project.key}`);
    } catch {}

    triggerWebhooks(
      "worklog:deleted",
      {
        worklogId,
        timeSpentSeconds: worklog.timeSpentSeconds,
        issue: {
          id: worklog.issue.id,
          key: worklog.issue.key,
          title: worklog.issue.title,
        },
        remainingEstimateSeconds,
      },
      worklog.issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: worklog.issue.id,
      }
    );

    return { success: true as const, remainingEstimateSeconds };
  } catch (error) {
    return toActionError(error, "Failed to delete worklog");
  }
}
