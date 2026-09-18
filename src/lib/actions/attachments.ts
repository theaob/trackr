"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  projectIdForAttachment,
  projectIdForIssue,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import { MAX_ATTACHMENT_SIZE, sanitizeFileName, formatFileSize } from "@/lib/attachments";
import { deleteAttachmentFile, newStoredName, writeAttachmentFile } from "@/lib/attachmentStorage";

export async function uploadAttachment(issueId: string, formData: FormData) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "ADD_COMMENT");

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided" };
    }
    if (file.size === 0) {
      return { success: false, error: "The selected file is empty" };
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`,
      };
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue) throw new Error("Issue not found");

    const storedName = newStoredName();
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeAttachmentFile(issueId, storedName, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        issueId,
        fileName: sanitizeFileName(file.name || "attachment"),
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: DISPLAY_USER_SELECT } },
    });

    await prisma.activityLog.create({
      data: {
        issueId,
        userId: user.id,
        action: "ATTACHED",
        field: "attachment",
        newValue: attachment.fileName,
      },
    });

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}

    return { success: true as const, attachment };
  } catch (error) {
    return toActionError(error, "Failed to upload attachment");
  }
}

export async function deleteAttachment(attachmentId: string) {
  try {
    const projectId = await projectIdForAttachment(attachmentId);
    const { user, role } = await requireProjectPermission(projectId, "VIEW_PROJECT");

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { issue: { include: { project: true } } },
    });
    if (!attachment) throw new Error("Attachment not found");

    // An attachment belongs to its uploader; project administrators can moderate.
    if (attachment.uploadedById !== user.id && role !== "ADMIN") {
      return { success: false, error: "You can only remove attachments you uploaded." };
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await deleteAttachmentFile(attachment.issueId, attachment.storedName);

    try {
      revalidatePath(`/projects/${attachment.issue.project.key}`);
    } catch {}

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete attachment");
  }
}
