"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import {
  projectIdForComment,
  projectIdForIssue,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { findMentionedUsers } from "@/lib/mentions";


export async function addComment(
  issueId: string,
  /** Ignored: the author is taken from the session. */
  authorId: string,
  content: string
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "ADD_COMMENT");
    const actorId = user.id;

    if (!content.trim()) return { success: false, error: "Comment cannot be empty" };

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!issue) throw new Error("Issue not found");

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        issueId,
        authorId: actorId,
      },
      include: {
        author: { select: DISPLAY_USER_SELECT },
      },
    });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: actorId,
        action: "COMMENTED",
        field: "comment",
        newValue: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
      },
    });

    // Notify Assignee if not the author
    if (issue.assigneeId && issue.assigneeId !== actorId) {
      await prisma.notification.create({
        data: {
          userId: issue.assigneeId,
          title: `New comment on ${issue.key}`,
          message: `${comment.author.name}: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`,
          link: `/projects/${issue.project.key}/board?selectedIssue=${issue.key}`,
        },
      });
    }

    // Notify Reporter if not author and not assignee
    if (issue.reporterId && issue.reporterId !== actorId && issue.reporterId !== issue.assigneeId) {
      await prisma.notification.create({
        data: {
          userId: issue.reporterId,
          title: `New comment on ${issue.key}`,
          message: `${comment.author.name}: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`,
          link: `/projects/${issue.project.key}/board?selectedIssue=${issue.key}`,
        },
      });
    }

    // Notify project members mentioned in the comment.
    const mentioned = await findMentionedUsers(projectId, content, {
      exclude: [actorId, issue.assigneeId, issue.reporterId],
    });

    if (mentioned.length > 0) {
      const snippet = content.slice(0, 60);
      const ellipsis = content.length > 60 ? "..." : "";

      await prisma.notification.createMany({
        data: mentioned.map((mUser) => ({
          userId: mUser.id,
          title: `Mentioned in comment on ${issue.key}`,
          message: `${comment.author.name} mentioned you: "${snippet}${ellipsis}"`,
          link: `/projects/${issue.project.key}/board?selectedIssue=${issue.key}`,
        })),
      });

      await prisma.activityLog.createMany({
        data: mentioned.map((mUser) => ({
          issueId,
          userId: actorId,
          action: "MENTIONED",
          field: "comment",
          newValue: mUser.name,
        })),
      });
    }

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}
    triggerWebhooks(
      "comment:created",
      {
        comment,
        issue: { id: issue.id, key: issue.key, title: issue.title },
      },
      issue.projectId
    );
    return { success: true as const, comment };
  } catch (error) {
    return toActionError(error, "Failed to post comment");
  }
}


export async function deleteComment(commentId: string) {
  try {
    const projectId = await projectIdForComment(commentId);
    const { user, role } = await requireProjectPermission(projectId, "VIEW_PROJECT");

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        issue: {
          include: { project: true },
        },
      },
    });

    if (!comment) throw new Error("Comment not found");

    // A comment belongs to its author; project administrators can moderate.
    if (comment.authorId !== user.id && role !== "ADMIN") {
      return { success: false, error: "You can only delete your own comments." };
    }

    await prisma.comment.delete({ where: { id: commentId } });

    revalidatePath(`/projects/${comment.issue.project.key}`);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete comment");
  }
}
