"use server";

import prisma from "@/lib/db";
import { IssueStatus, IssueType, PriorityLevel } from "@/types";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";


export async function getProjectIssues(projectId: string) {
  try {
    const issues = await prisma.issue.findMany({
      where: { projectId },
      include: {
        project: true,
        assignee: true,
        reporter: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        children: {
          include: {
            assignee: true,
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return issues;
  } catch (error) {
    console.error("Failed to fetch project issues:", error);
    return [];
  }
}

export async function getBoardIssues(projectId: string, activeSprintId?: string | null) {
  try {
    const issues = await prisma.issue.findMany({
      where: activeSprintId
        ? { projectId, sprintId: activeSprintId }
        : { projectId, sprintId: null, status: { not: "BACKLOG" } },
      include: {
        project: true,
        assignee: true,
        reporter: true,
        version: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 150,
    });
    return issues;
  } catch (error) {
    console.error("Failed to fetch board issues:", error);
    return [];
  }
}

export async function getIssueByKeyOrId(keyOrId: string) {
  try {
    const issue = await prisma.issue.findFirst({
      where: {
        OR: [{ id: keyOrId }, { key: keyOrId }, { key: keyOrId.toUpperCase() }],
      },
      include: {
        project: true,
        assignee: true,
        reporter: true,
        version: true,
        sprint: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        children: {
          include: {
            assignee: true,
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return issue;
  } catch (error) {
    console.error("Failed to fetch issue by key or id:", error);
    return null;
  }
}

export async function getBacklogIssues(projectId: string) {
  try {
    // Return issues in sprints (up to 300) + top backlog items (up to 100)
    const [sprintIssues, backlogIssues] = await Promise.all([
      prisma.issue.findMany({
        where: { projectId, sprintId: { not: null } },
        include: {
          project: true,
          assignee: true,
          reporter: true,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 300,
      }),
      prisma.issue.findMany({
        where: { projectId, sprintId: null, status: "BACKLOG" },
        include: {
          project: true,
          assignee: true,
          reporter: true,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
    ]);

    return [...sprintIssues, ...backlogIssues];
  } catch (error) {
    console.error("Failed to fetch backlog issues:", error);
    return [];
  }
}

export async function getAllCrossProjectIssues(projectId?: string) {
  try {
    const issues = await prisma.issue.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: true,
        assignee: true,
        reporter: true,
        version: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        children: {
          include: {
            assignee: true,
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return issues;
  } catch (error) {
    console.error("Failed to fetch cross-project issues:", error);
    return [];
  }
}

export interface PaginatedIssuesParams {
  projectId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  preset?: string;
  currentUserId?: string;
  type?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  reporterId?: string;
  sprintId?: string;
  versionId?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export async function getPaginatedIssues(params: PaginatedIssuesParams) {
  try {
    const where: any = {};

    if (params.projectId && params.projectId !== "ALL") {
      where.projectId = params.projectId;
    }

    if (params.type && params.type !== "ALL") {
      where.type = params.type;
    }

    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    if (params.priority && params.priority !== "ALL") {
      where.priority = params.priority;
    }

    if (params.assigneeId && params.assigneeId !== "ALL") {
      if (params.assigneeId === "UNASSIGNED") {
        where.assigneeId = null;
      } else {
        where.assigneeId = params.assigneeId;
      }
    }

    if (params.reporterId && params.reporterId !== "ALL") {
      where.reporterId = params.reporterId;
    }

    if (params.sprintId && params.sprintId !== "ALL") {
      if (params.sprintId === "BACKLOG") {
        where.sprintId = null;
      } else {
        where.sprintId = params.sprintId;
      }
    }

    if (params.versionId && params.versionId !== "ALL") {
      if (params.versionId === "UNASSIGNED") {
        where.versionId = null;
      } else {
        where.versionId = params.versionId;
      }
    }

    if (params.preset === "MY_OPEN" && params.currentUserId) {
      where.assigneeId = params.currentUserId;
      where.status = { not: "DONE" };
    } else if (params.preset === "REPORTED_BY_ME" && params.currentUserId) {
      where.reporterId = params.currentUserId;
    } else if (params.preset === "DONE") {
      where.status = "DONE";
    } else if (params.preset === "HIGH_PRIORITY") {
      where.priority = { in: ["HIGH", "HIGHEST"] };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { key: { contains: q } },
        { title: { contains: q } },
      ];
    }

    const sortField = params.sortField || "createdAt";
    const sortOrder = params.sortOrder || "desc";
    const allowedSortFields = ["key", "title", "status", "priority", "storyPoints", "createdAt", "updatedAt"];
    const orderBy: any = {};
    if (allowedSortFields.includes(sortField)) {
      orderBy[sortField] = sortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const [issues, totalCount] = await prisma.$transaction([
      prisma.issue.findMany({
        where,
        include: {
          project: true,
          assignee: true,
          reporter: true,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
          comments: {
            include: { author: true },
            orderBy: { createdAt: "desc" },
          },
          activityLogs: {
            include: { user: true },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.issue.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      issues,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("Failed to fetch paginated issues:", error);
    return {
      issues: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    };
  }
}

export async function createIssue(data: {
  title: string;
  description?: string;
  type: IssueType;
  priority?: PriorityLevel;
  status?: IssueStatus;
  projectId: string;
  sprintId?: string | null;
  versionId?: string | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  parentId?: string | null;
  storyPoints?: number | null;
}) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { key: true },
    });

    if (!project) throw new Error("Project not found");

    // Fast indexed count to determine next key
    const issueCount = await prisma.issue.count({
      where: { projectId: data.projectId },
    });

    let nextNum = issueCount + 1;
    let nextKey = `${project.key}-${nextNum}`;
    while (await prisma.issue.findUnique({ where: { key: nextKey }, select: { id: true } })) {
      nextNum++;
      nextKey = `${project.key}-${nextNum}`;
    }

    if (data.sprintId) {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: data.sprintId },
      });
      if (!targetSprint) throw new Error("Sprint not found");
      if (targetSprint.status === "COMPLETED") {
        return { success: false, error: "Cannot add items to finished sprints" };
      }
    }

    const newIssue = await prisma.issue.create({
      data: {
        key: nextKey,
        title: data.title.trim(),
        description: data.description || "",
        type: data.type,
        priority: data.priority || "MEDIUM",
        status: data.status || "TODO",
        storyPoints: data.storyPoints ?? null,
        projectId: data.projectId,
        sprintId: data.sprintId || null,
        versionId: data.versionId || null,
        assigneeId: data.assigneeId || null,
        reporterId: data.reporterId || null,
        parentId: data.parentId || null,
      },
      include: {
        assignee: true,
        reporter: true,
        version: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
      },
    });

    if (data.reporterId) {
      await prisma.activityLog.create({
        data: {
          issueId: newIssue.id,
          userId: data.reporterId,
          action: "CREATED",
          field: "issue",
          newValue: newIssue.key,
        },
      });
    }

    if (data.assigneeId && data.assigneeId !== data.reporterId) {
      await prisma.notification.create({
        data: {
          userId: data.assigneeId,
          title: `You were assigned to ${newIssue.key}`,
          message: newIssue.title,
          link: `/projects/${project.key}/board?selectedIssue=${newIssue.key}`,
        },
      });
    }

    // Notify users mentioned in issue description
    if (data.description) {
      const allUsers = await prisma.user.findMany();
      const descLower = data.description.toLowerCase();
      const mentionedUsers = allUsers.filter((u) => {
        if (u.id === data.reporterId || u.id === data.assigneeId) return false;
        const fullNamePattern = `@${u.name.toLowerCase()}`;
        const bracketPattern = `@[${u.name.toLowerCase()}]`;
        const firstNamePattern = `@${u.name.split(" ")[0].toLowerCase()}`;
        return (
          descLower.includes(fullNamePattern) ||
          descLower.includes(bracketPattern) ||
          new RegExp(`\\b${firstNamePattern}\\b`, "i").test(data.description!)
        );
      });

      for (const mUser of mentionedUsers) {
        await prisma.notification.create({
          data: {
            userId: mUser.id,
            title: `Mentioned in ${newIssue.key}`,
            message: `You were mentioned in ${newIssue.key}: "${data.description.slice(0, 60)}${data.description.length > 60 ? "..." : ""}"`,
            link: `/projects/${project.key}/board?selectedIssue=${newIssue.key}`,
          },
        });

        if (data.reporterId) {
          await prisma.activityLog.create({
            data: {
              issueId: newIssue.id,
              userId: data.reporterId,
              action: "MENTIONED",
              field: "description",
              newValue: mUser.name,
            },
          });
        }
      }
    }

    try {
      revalidatePath(`/projects/${project.key}`);
    } catch {}

    triggerWebhooks("issue:created", newIssue, data.projectId);
    return { success: true, issue: newIssue };
  } catch (error) {
    console.error("Failed to create issue:", error);
    return { success: false, error: "Failed to create issue" };
  }
}


export async function updateIssue(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: IssueStatus;
    priority?: PriorityLevel;
    type?: IssueType;
    storyPoints?: number | null;
    assigneeId?: string | null;
    sprintId?: string | null;
    versionId?: string | null;
    parentId?: string | null;
    updatedByUserId?: string;
  }
) {
  try {
    const existing = await prisma.issue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) throw new Error("Issue not found");

    if (data.sprintId && data.sprintId !== existing.sprintId) {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: data.sprintId },
      });
      if (!targetSprint) throw new Error("Sprint not found");
      if (targetSprint.status === "COMPLETED") {
        return { success: false, error: "Cannot add items to finished sprints" };
      }
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.storyPoints !== undefined && { storyPoints: data.storyPoints }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.sprintId !== undefined && { sprintId: data.sprintId }),
        ...(data.versionId !== undefined && { versionId: data.versionId }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        assignee: true,
        reporter: true,
        version: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        children: {
          include: {
            assignee: true,
          },
        },
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Record activity logs if changes happened and user is provided
    if (data.updatedByUserId) {
      if (data.status && data.status !== existing.status) {
        await prisma.activityLog.create({
          data: {
            issueId: id,
            userId: data.updatedByUserId,
            action: "STATUS_CHANGED",
            field: "status",
            oldValue: existing.status,
            newValue: data.status,
          },
        });

        if (existing.assigneeId && existing.assigneeId !== data.updatedByUserId) {
          await prisma.notification.create({
            data: {
              userId: existing.assigneeId,
              title: `${existing.key} moved to ${data.status}`,
              message: `Status was updated from ${existing.status} to ${data.status}`,
              link: `/projects/${existing.project.key}/board?selectedIssue=${existing.key}`,
            },
          });
        }
      }

      if (data.priority && data.priority !== existing.priority) {
        await prisma.activityLog.create({
          data: {
            issueId: id,
            userId: data.updatedByUserId,
            action: "PRIORITY_CHANGED",
            field: "priority",
            oldValue: existing.priority,
            newValue: data.priority,
          },
        });
      }

      if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
        await prisma.activityLog.create({
          data: {
            issueId: id,
            userId: data.updatedByUserId,
            action: "ASSIGNMENT_CHANGED",
            field: "assignee",
            oldValue: existing.assigneeId || "Unassigned",
            newValue: data.assigneeId || "Unassigned",
          },
        });

        if (data.assigneeId && data.assigneeId !== data.updatedByUserId) {
          await prisma.notification.create({
            data: {
              userId: data.assigneeId,
              title: `You were assigned to ${existing.key}`,
              message: existing.title,
              link: `/projects/${existing.project.key}/board?selectedIssue=${existing.key}`,
            },
          });
        }
      }

      // Check if description was updated with user mentions
      if (
        data.description !== undefined &&
        data.description !== existing.description &&
        data.description
      ) {
        const allUsers = await prisma.user.findMany();
        const descLower = data.description.toLowerCase();
        const prevDescLower = (existing.description || "").toLowerCase();

        const mentionedUsers = allUsers.filter((u) => {
          if (u.id === data.updatedByUserId || u.id === existing.assigneeId) return false;
          const fullNamePattern = `@${u.name.toLowerCase()}`;
          const bracketPattern = `@[${u.name.toLowerCase()}]`;
          const firstNamePattern = `@${u.name.split(" ")[0].toLowerCase()}`;
          const isNowMentioned =
            descLower.includes(fullNamePattern) ||
            descLower.includes(bracketPattern) ||
            new RegExp(`\\b${firstNamePattern}\\b`, "i").test(data.description!);
          const wasMentioned =
            prevDescLower.includes(fullNamePattern) ||
            prevDescLower.includes(bracketPattern) ||
            new RegExp(`\\b${firstNamePattern}\\b`, "i").test(existing.description || "");

          return isNowMentioned && !wasMentioned;
        });

        for (const mUser of mentionedUsers) {
          await prisma.notification.create({
            data: {
              userId: mUser.id,
              title: `Mentioned in ${existing.key}`,
              message: `You were mentioned in ${existing.key}: "${data.description.slice(0, 60)}${data.description.length > 60 ? "..." : ""}"`,
              link: `/projects/${existing.project.key}/board?selectedIssue=${existing.key}`,
            },
          });

          await prisma.activityLog.create({
            data: {
              issueId: id,
              userId: data.updatedByUserId,
              action: "MENTIONED",
              field: "description",
              newValue: mUser.name,
            },
          });
        }
      }
    }

    try {
      revalidatePath(`/projects/${existing.project.key}`);
    } catch {}
    triggerWebhooks("issue:updated", { issue: updated, changes: data }, existing.projectId);
    return { success: true, issue: updated };
  } catch (error) {
    console.error("Failed to update issue:", error);
    return { success: false, error: "Failed to update issue" };
  }
}

export async function updateIssueStatusAndOrder(
  issueId: string,
  newStatus: IssueStatus,
  newOrder: number,
  userId?: string
) {
  try {
    const existing = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!existing) throw new Error("Issue not found");

    const statusChanged = existing.status !== newStatus;

    await prisma.issue.update({
      where: { id: issueId },
      data: {
        status: newStatus,
        order: newOrder,
      },
    });

    if (statusChanged && userId) {
      await prisma.activityLog.create({
        data: {
          issueId,
          userId,
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: existing.status,
          newValue: newStatus,
        },
      });

      if (existing.assigneeId && existing.assigneeId !== userId) {
        await prisma.notification.create({
          data: {
            userId: existing.assigneeId,
            title: `${existing.key} moved to ${newStatus}`,
            message: `Moved from ${existing.status} to ${newStatus}`,
            link: `/projects/${existing.project.key}/board?selectedIssue=${existing.key}`,
          },
        });
      }
    }

    try {
      revalidatePath(`/projects/${existing.project.key}`);
    } catch {}

    triggerWebhooks(
      "issue:updated",
      { issueId, key: existing.key, status: newStatus, order: newOrder },
      existing.projectId
    );
    return { success: true };
  } catch (error) {
    console.error("Failed to update issue status & order:", error);
    return { success: false, error: "Failed to update issue position" };
  }
}

export async function deleteIssue(id: string) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!issue) throw new Error("Issue not found");

    await prisma.issue.delete({ where: { id } });

    try {
      revalidatePath(`/projects/${issue.project.key}`);
    } catch {}

    triggerWebhooks(
      "issue:deleted",
      { id: issue.id, key: issue.key, title: issue.title },
      issue.projectId
    );
    return { success: true };
  } catch (error) {
    console.error("Failed to delete issue:", error);

    return { success: false, error: "Failed to delete issue" };
  }
}

