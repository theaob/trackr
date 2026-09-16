"use server";

import prisma from "@/lib/db";
import { CustomFieldType } from "@/types";
import { revalidatePath } from "next/cache";
import {
  projectIdForCustomField,
  projectIdForIssue,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";

export async function getProjectCustomFields(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    const fields = await prisma.customField.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return fields;
  } catch (error) {
    console.error("Failed to fetch project custom fields:", error);
    return [];
  }
}

export async function createCustomField(data: {
  projectId: string;
  name: string;
  description?: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}) {
  try {
    await requireProjectPermission(data.projectId, "PROJECT_ADMIN");

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { key: true },
    });
    if (!project) throw new Error("Project not found");

    const optionsStr = data.options && data.options.length > 0
      ? JSON.stringify(data.options.map((o) => o.trim()).filter(Boolean))
      : null;

    const field = await prisma.customField.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        type: data.type,
        options: optionsStr,
        required: data.required || false,
        projectId: data.projectId,
      },
    });

    try {
      revalidatePath(`/projects/${project.key}/settings`);
    } catch {}
    return { success: true as const, field };
  } catch (error) {
    return toActionError(error, "Failed to create custom field");
  }
}

export async function updateCustomField(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    type?: CustomFieldType;
    options?: string[];
    required?: boolean;
  }
) {
  try {
    await requireProjectPermission(await projectIdForCustomField(id), "PROJECT_ADMIN");

    const existing = await prisma.customField.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Custom field not found");

    const optionsStr =
      data.options !== undefined
        ? data.options.length > 0
          ? JSON.stringify(data.options.map((o) => o.trim()).filter(Boolean))
          : null
        : undefined;

    const updated = await prisma.customField.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.type !== undefined && { type: data.type }),
        ...(optionsStr !== undefined && { options: optionsStr }),
        ...(data.required !== undefined && { required: data.required }),
      },
    });

    try {
      revalidatePath(`/projects/${existing.project.key}/settings`);
    } catch {}
    return { success: true as const, field: updated };
  } catch (error) {
    return toActionError(error, "Failed to update custom field");
  }
}

export async function deleteCustomField(id: string) {
  try {
    await requireProjectPermission(await projectIdForCustomField(id), "PROJECT_ADMIN");

    const existing = await prisma.customField.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Custom field not found");

    await prisma.customField.delete({ where: { id } });

    try {
      revalidatePath(`/projects/${existing.project.key}/settings`);
    } catch {}
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete custom field");
  }
}

export async function getIssueCustomFieldValues(issueId: string) {
  try {
    await requireProjectAccess(await projectIdForIssue(issueId));

    const values = await prisma.customFieldValue.findMany({
      where: { issueId },
      include: { customField: true },
    });
    return values;
  } catch (error) {
    console.error("Failed to fetch issue custom field values:", error);
    return [];
  }
}

export async function setIssueCustomFieldValue(
  issueId: string,
  customFieldId: string,
  value: string
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    await requireProjectPermission(projectId, "EDIT_ISSUE");
    await assertFieldsBelongToProject(projectId, [customFieldId]);

    const trimmed = (value ?? "").trim();

    if (trimmed === "") {
      // Remove if empty
      await prisma.customFieldValue.deleteMany({
        where: { issueId, customFieldId },
      });
      return { success: true as const, value: null };
    }

    const val = await prisma.customFieldValue.upsert({
      where: {
        issueId_customFieldId: {
          issueId,
          customFieldId,
        },
      },
      update: { value: trimmed },
      create: {
        issueId,
        customFieldId,
        value: trimmed,
      },
      include: { customField: true },
    });

    return { success: true as const, value: val };
  } catch (error) {
    return toActionError(error, "Failed to set custom field value");
  }
}

export async function batchSetIssueCustomFieldValues(
  issueId: string,
  values: Record<string, string>
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    await requireProjectPermission(projectId, "EDIT_ISSUE");

    const entries = Object.entries(values);
    if (entries.length === 0) return { success: true as const };

    await assertFieldsBelongToProject(
      projectId,
      entries.map(([customFieldId]) => customFieldId)
    );

    await prisma.$transaction(
      entries.map(([customFieldId, rawVal]) => {
        const val = (rawVal ?? "").trim();
        if (val === "") {
          return prisma.customFieldValue.deleteMany({
            where: { issueId, customFieldId },
          });
        }
        return prisma.customFieldValue.upsert({
          where: {
            issueId_customFieldId: {
              issueId,
              customFieldId,
            },
          },
          update: { value: val },
          create: {
            issueId,
            customFieldId,
            value: val,
          },
        });
      })
    );

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to batch set custom field values");
  }
}

/**
 * Custom field values are addressed by issue and field id, so confirm the
 * fields are defined on the same project as the issue before writing them.
 */
async function assertFieldsBelongToProject(projectId: string, fieldIds: string[]) {
  const ids = Array.from(new Set(fieldIds));
  if (ids.length === 0) return;

  const count = await prisma.customField.count({
    where: { id: { in: ids }, projectId },
  });

  if (count !== ids.length) {
    throw new Error("Custom field does not belong to this project");
  }
}
