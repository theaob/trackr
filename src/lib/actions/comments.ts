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
  canModerateProject,
} from "@/lib/auth/guards";
import { notifyMentions } from "@/lib/mentions";
import { issueLink, notifyUsers, notifyWatchers } from "@/lib/notify";


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

    const commentNotice = {
      title: `New comment on ${issue.key}`,
      message: `${comment.author.name}: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`,
      link: issueLink(issue.project.key, issue.key),
    };

    // Everyone mentioned hears about it as a mention, the assignee and
    // reporter included; the assignee and reporter otherwise hear about every
    // comment but their own.
    const mentioned = await notifyMentions({
      issue: { id: issueId, key: issue.key, projectId, projectKey: issue.project.key },
      text: content,
      actor: { id: actorId, name: comment.author.name },
      where: "comment",
    });
    await notifyUsers(projectId, [issue.assigneeId, issue.reporterId], commentNotice, [actorId, ...mentioned]);

    await notifyWatchers(
      issueId,
      [actorId, issue.assigneeId, issue.reporterId, ...mentioned],
      commentNotice.title,
      commentNotice.message,
      commentNotice.link
    );

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}
    triggerWebhooks(
      "comment:created",
      {
        comment,
        issue: { id: issue.id, key: issue.key, title: issue.title },
      },
      issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: issue.id,
      }
    );
    return { success: true as const, comment };
  } catch (error) {
    return toActionError(error, "Failed to post comment");
  }
}

export async function updateComment(commentId: string, content: string) {
  try {
    const projectId = await projectIdForComment(commentId);
    const auth = await requireProjectPermission(projectId, "VIEW_PROJECT");
    const { user } = auth;

    if (!content.trim()) return { success: false, error: "Comment cannot be empty" };

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
    if (comment.authorId !== user.id && !(await canModerateProject(auth))) {
      return { success: false, error: "You can only edit your own comments." };
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: { author: { select: DISPLAY_USER_SELECT } },
    });

    // People added to the comment by this edit hear about it too.
    await notifyMentions({
      issue: { id: comment.issueId, key: comment.issue.key, projectId, projectKey: comment.issue.project.key },
      text: content.trim(),
      previousText: comment.content,
      actor: { id: user.id, name: user.name },
      where: "comment",
    });

    await prisma.activityLog.create({
      data: {
        issueId: comment.issueId,
        userId: user.id,
        action: "COMMENTED",
        field: "comment",
        newValue: `Edited: ${content.trim().slice(0, 40)}${content.trim().length > 40 ? "..." : ""}`,
      },
    });

    try {
      revalidatePath(`/projects/${comment.issue.project.key}`);
    } catch {}

    triggerWebhooks(
      "comment:updated",
      {
        comment: updated,
        issue: { id: comment.issue.id, key: comment.issue.key, title: comment.issue.title },
      },
      comment.issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: comment.issue.id,
      }
    );

    return { success: true as const, comment: updated };
  } catch (error) {
    return toActionError(error, "Failed to update comment");
  }
}

export async function deleteComment(commentId: string) {
  try {
    const projectId = await projectIdForComment(commentId);
    const auth = await requireProjectPermission(projectId, "VIEW_PROJECT");
    const { user } = auth;

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
    if (comment.authorId !== user.id && !(await canModerateProject(auth))) {
      return { success: false, error: "You can only delete your own comments." };
    }

    await prisma.comment.delete({ where: { id: commentId } });

    revalidatePath(`/projects/${comment.issue.project.key}`);

    triggerWebhooks(
      "comment:deleted",
      {
        commentId,
        issue: { id: comment.issue.id, key: comment.issue.key, title: comment.issue.title },
      },
      comment.issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: comment.issue.id,
      }
    );

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete comment");
  }
}
