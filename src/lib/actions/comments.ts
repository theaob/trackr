"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";


export async function addComment(issueId: string, authorId: string, content: string) {
  try {
    if (!content.trim()) throw new Error("Comment cannot be empty");

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true, assignee: true, reporter: true },
    });

    if (!issue) throw new Error("Issue not found");

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        issueId,
        authorId,
      },
      include: {
        author: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: authorId,
        action: "COMMENTED",
        field: "comment",
        newValue: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
      },
    });

    // Notify Assignee if not the author
    if (issue.assigneeId && issue.assigneeId !== authorId) {
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
    if (issue.reporterId && issue.reporterId !== authorId && issue.reporterId !== issue.assigneeId) {
      await prisma.notification.create({
        data: {
          userId: issue.reporterId,
          title: `New comment on ${issue.key}`,
          message: `${comment.author.name}: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`,
          link: `/projects/${issue.project.key}/board?selectedIssue=${issue.key}`,
        },
      });
    }

    // Notify Mentioned Users (@Full Name, @FirstName, or @[Full Name])
    const allUsers = await prisma.user.findMany();
    const contentLower = content.toLowerCase();
    const mentionedUsers = allUsers.filter((u) => {
      if (u.id === authorId || u.id === issue.assigneeId || u.id === issue.reporterId) {
        return false;
      }
      const fullNamePattern = `@${u.name.toLowerCase()}`;
      const bracketPattern = `@[${u.name.toLowerCase()}]`;
      const firstNamePattern = `@${u.name.split(" ")[0].toLowerCase()}`;
      return (
        contentLower.includes(fullNamePattern) ||
        contentLower.includes(bracketPattern) ||
        new RegExp(`\\b${firstNamePattern}\\b`, "i").test(content)
      );
    });

    for (const mUser of mentionedUsers) {
      await prisma.notification.create({
        data: {
          userId: mUser.id,
          title: `Mentioned in comment on ${issue.key}`,
          message: `${comment.author.name} mentioned you: "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
          link: `/projects/${issue.project.key}/board?selectedIssue=${issue.key}`,
        },
      });

      await prisma.activityLog.create({
        data: {
          issueId,
          userId: authorId,
          action: "MENTIONED",
          field: "comment",
          newValue: mUser.name,
        },
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
    return { success: true, comment };
  } catch (error) {
    console.error("Failed to add comment:", error);
    return { success: false, error: "Failed to post comment" };
  }
}


export async function deleteComment(commentId: string) {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        issue: {
          include: { project: true },
        },
      },
    });

    if (!comment) throw new Error("Comment not found");

    await prisma.comment.delete({ where: { id: commentId } });

    revalidatePath(`/projects/${comment.issue.project.key}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return { success: false, error: "Failed to delete comment" };
  }
}
