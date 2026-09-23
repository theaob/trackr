"use server";

import prisma from "@/lib/db";
import { IssueStatus, IssueType, PriorityLevel, WebhookActor, WebhookChangelogItem } from "@/types";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import { issueLink, notifyStatusChange, notifyUsers } from "@/lib/notify";
import { deleteIssueAttachmentDir } from "@/lib/attachmentStorage";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import {
  accessibleProjectIds,
  AuthError,
  projectIdForIssue,
  teamProjectIds,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
  canModerateProject,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { findMentionedUsers } from "@/lib/mentions";
import { createIssueWithKey } from "@/lib/issueKeys";
import { attachStatusColors } from "@/lib/statusColorLookup";
import { planColumnOrder } from "@/lib/boardOrder";
import {
  getBacklogStatusNames,
  getDoneStatusNames,
  getInitialStatusName,
  getPrimaryBacklogStatusName,
  getWorkflowStatuses,
  isTransitionAllowed,
} from "@/lib/workflow";
import { TQLParser } from "@/lib/tql/parser";
import { TQLCompiler } from "@/lib/tql/compiler";

const USER_SELECT = { select: DISPLAY_USER_SELECT } as const;

function revalidateProjectRoutes(projectKey: string) {
  try {
    revalidatePath(`/projects/${projectKey}`);
    revalidatePath(`/projects/${projectKey}/board`);
    revalidatePath(`/projects/${projectKey}/backlog`);
    revalidatePath(`/projects/${projectKey}/reports`);
    revalidatePath(`/projects/${projectKey}/issues`);
    revalidatePath(`/projects/${projectKey}/releases`);
  } catch {}
}

const LINKED_ISSUE_SELECT = {
  id: true,
  key: true,
  title: true,
  type: true,
  status: true,
  projectId: true,
  project: { select: { key: true, name: true } },
} as const;

// An issue carries only its latest comments and activity; "Show older" pages
// through the rest with getOlderIssueHistory. The counts say how many exist.
const HISTORY_PAGE_SIZE = 50;
const HISTORY_ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];
const RECENT_HISTORY_INCLUDE = {
  comments: { include: { author: USER_SELECT }, orderBy: HISTORY_ORDER, take: HISTORY_PAGE_SIZE },
  activityLogs: { include: { user: USER_SELECT }, orderBy: HISTORY_ORDER, take: HISTORY_PAGE_SIZE },
  _count: { select: { comments: true, activityLogs: true } },
} as const;

const LABELS_INCLUDE = {
  labels: { include: { label: true }, orderBy: { label: { name: "asc" } } },
} as const;

/**
 * Epics only, for the parent pickers in the project chrome. Kept separate so
 * the layout does not have to load the project's issues to find them.
 */
export async function getProjectEpics(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    return await prisma.issue.findMany({
      where: { projectId, type: "EPIC" },
      select: {
        id: true,
        key: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        projectId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (error) {
    console.error("Failed to fetch project epics:", error);
    return [];
  }
}

/**
 * Find candidate issues in the project that can be linked to an epic (including other epics).
 */
export async function searchProjectIssuesForEpic(projectId: string, epicId: string, query: string) {
  try {
    await requireProjectAccess(projectId);
    const trimmed = query.trim();

    // Prevent circular parenting: an epic cannot link itself, nor any issue/epic
    // that is an ancestor of this epic (which would create a cycle).
    const forbiddenIds = new Set<string>([epicId]);
    let currentParentId: string | null | undefined = epicId;
    while (currentParentId) {
      const issue: { parentId: string | null } | null = await prisma.issue.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      if (issue?.parentId) {
        forbiddenIds.add(issue.parentId);
        currentParentId = issue.parentId;
      } else {
        currentParentId = null;
      }
    }

    return await prisma.issue.findMany({
      where: {
        projectId,
        id: { notIn: Array.from(forbiddenIds) },
        OR: [
          { parentId: null },
          { parentId: { not: epicId } },
        ],
        ...(trimmed
          ? {
              AND: [
                {
                  OR: [
                    { key: { contains: trimmed } },
                    { title: { contains: trimmed } },
                  ],
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        key: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        storyPoints: true,
        assignee: USER_SELECT,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  } catch (error) {
    console.error("Failed to search issues for epic:", error);
    return [];
  }
}

export async function getBoardIssues(projectId: string, activeSprintId?: string | null) {
  try {
    await requireProjectAccess(projectId);

    const backlogNames = activeSprintId ? [] : await getBacklogStatusNames(projectId);
    const issues = await prisma.issue.findMany({
      where: activeSprintId
        ? { projectId, sprintId: activeSprintId }
        : { projectId, sprintId: null, status: { notIn: backlogNames } },
      include: {
        project: true,
        assignee: USER_SELECT,
        reporter: USER_SELECT,
        version: true,
        parent: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        ...LABELS_INCLUDE,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
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
        assignee: USER_SELECT,
        reporter: USER_SELECT,
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
            assignee: USER_SELECT,
          },
          orderBy: { createdAt: "asc" },
        },
        ...RECENT_HISTORY_INCLUDE,
        linksAsSource: {
          include: { target: { select: LINKED_ISSUE_SELECT } },
          orderBy: { createdAt: "asc" },
        },
        linksAsTarget: {
          include: { source: { select: LINKED_ISSUE_SELECT } },
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          include: { uploadedBy: USER_SELECT },
          orderBy: { createdAt: "desc" },
        },
        components: {
          include: { component: { include: { lead: USER_SELECT } } },
          orderBy: { component: { name: "asc" } },
        },
        worklogs: {
          include: { author: USER_SELECT },
          orderBy: { workDate: "desc" },
        },
        ...LABELS_INCLUDE,
      },
    });

    if (!issue) return null;
    await requireProjectAccess(issue.projectId);

    // Linked issues can live in other projects; color their statuses by their own workflow.
    const [targets, sources] = await Promise.all([
      attachStatusColors(issue.linksAsSource.map((l) => l.target)),
      attachStatusColors(issue.linksAsTarget.map((l) => l.source)),
    ]);
    return {
      ...issue,
      linksAsSource: issue.linksAsSource.map((l, i) => ({ ...l, target: targets[i] })),
      linksAsTarget: issue.linksAsTarget.map((l, i) => ({ ...l, source: sources[i] })),
    };
  } catch (error) {
    console.error("Failed to fetch issue by key or id:", error);
    return null;
  }
}

/** The next page of an issue's comments or activity, older than `beforeId`. */
export async function getOlderIssueHistory(
  issueId: string,
  kind: "comments" | "activity",
  beforeId: string
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    await requireProjectAccess(projectId);
    const page = { orderBy: HISTORY_ORDER, cursor: { id: beforeId }, skip: 1, take: HISTORY_PAGE_SIZE };
    if (kind === "comments") {
      return await prisma.comment.findMany({ where: { issueId }, include: { author: USER_SELECT }, ...page });
    }
    return await prisma.activityLog.findMany({ where: { issueId }, include: { user: USER_SELECT }, ...page });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("Failed to fetch older issue history:", error);
    return [];
  }
}

export async function getBacklogIssues(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    const backlogNames = await getBacklogStatusNames(projectId);

    // Return issues in sprints (up to 300) + top backlog items (up to 100).
    // Epics are excluded: epics span multiple sprints and are managed via roadmap/filters.
    const [sprintIssues, backlogIssues] = await Promise.all([
      prisma.issue.findMany({
        where: { projectId, sprintId: { not: null }, type: { not: "EPIC" } },
        include: {
          project: true,
          assignee: USER_SELECT,
          reporter: USER_SELECT,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
          ...LABELS_INCLUDE,
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        take: 300,
      }),
      prisma.issue.findMany({
        where: { projectId, sprintId: null, status: { in: backlogNames }, type: { not: "EPIC" } },
        include: {
          project: true,
          assignee: USER_SELECT,
          reporter: USER_SELECT,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
          ...LABELS_INCLUDE,
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        take: 500,
      }),
    ]);

    return [...sprintIssues, ...backlogIssues];
  } catch (error) {
    console.error("Failed to fetch backlog issues:", error);
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
  label?: string;
  tql?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export async function getPaginatedIssues(params: PaginatedIssuesParams) {
  const empty = { issues: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 };

  try {
    const user = await getCurrentUser();
    const accessibleIds: string[] = [];

    if (params.projectId && params.projectId !== "ALL") {
      await requireProjectAccess(params.projectId);
      accessibleIds.push(params.projectId);
    } else {
      const ids = await accessibleProjectIds(user?.id ?? null);
      if (ids.length === 0) return empty;
      accessibleIds.push(...ids);
    }

    let where: any = {};
    let orderBy: any = {};

    if (params.tql && params.tql.trim()) {
      const parseRes = TQLParser.parse(params.tql);
      if (!parseRes.success) {
        return { ...empty, error: parseRes.error.message };
      }

      const [activeSprints, unreleasedVersions] = await Promise.all([
        prisma.sprint.findMany({
          where: { projectId: { in: accessibleIds }, status: "ACTIVE" },
          select: { id: true },
        }),
        prisma.version.findMany({
          where: { projectId: { in: accessibleIds }, status: "UNRELEASED" },
          select: { id: true },
        }),
      ]);

      const compiler = new TQLCompiler({
        currentUserId: user?.id,
        accessibleProjectIds: accessibleIds,
        emailMatchProjectIds: Array.from(await teamProjectIds(user?.id)),
        activeSprintIds: activeSprints.map((s) => s.id),
        unreleasedVersionIds: unreleasedVersions.map((v) => v.id),
      });

      const compiled = compiler.compile(parseRes.query);
      where = compiled.where;
      if (compiled.orderBy.length > 0) {
        orderBy = compiled.orderBy;
      } else {
        orderBy = { createdAt: "desc" };
      }
    } else {
      where.projectId = params.projectId && params.projectId !== "ALL" ? params.projectId : { in: accessibleIds };

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

      if (params.label && params.label !== "ALL") {
        where.labels = { some: { label: { name: params.label } } };
      }

      const singleProjectId = params.projectId && params.projectId !== "ALL" ? params.projectId : null;
      const doneNames = singleProjectId ? await getDoneStatusNames(singleProjectId) : ["DONE"];

      if (params.preset === "MY_OPEN" && user) {
        where.assigneeId = user.id;
        where.status = { notIn: doneNames };
      } else if (params.preset === "REPORTED_BY_ME" && user) {
        where.reporterId = user.id;
      } else if (params.preset === "DONE") {
        where.status = { in: doneNames };
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
      const allowedSortFields = ["key", "title", "status", "priority", "storyPoints", "dueDate", "createdAt", "updatedAt"];
      if (allowedSortFields.includes(sortField)) {
        orderBy[sortField] = sortOrder;
      } else {
        orderBy.createdAt = "desc";
      }
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const [issues, totalCount] = await prisma.$transaction([
      prisma.issue.findMany({
        where,
        include: {
          project: true,
          assignee: USER_SELECT,
          reporter: USER_SELECT,
          version: true,
          parent: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
          // Comment and activity threads are loaded by the detail modal, not
          // eagerly for every row of the table.
          _count: { select: { comments: true } },
          ...LABELS_INCLUDE,
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
    return empty;
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
  startDate?: string | null;
  dueDate?: string | null;
  order?: number;
}) {
  try {
    const { user } = await requireProjectPermission(data.projectId, "CREATE_ISSUE");

    const title = data.title?.trim();
    if (!title) return { success: false, error: "Issue title is required" };

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { key: true, boardType: true },
    });
    if (!project) throw new Error("Project not found");

    if (data.type === "EPIC" && data.sprintId) {
      return { success: false, error: "Epics cannot be assigned to a sprint" };
    }

    if (project.boardType === "KANBAN" && data.sprintId) {
      return { success: false, error: "Kanban projects do not use sprints" };
    }

    const related = await validateIssueRelations(data.projectId, {
      sprintId: data.sprintId,
      versionId: data.versionId,
      parentId: data.parentId,
      assigneeId: data.assigneeId,
    });
    if (related.error) return { success: false, error: related.error };

    let status = data.status;
    if (status === undefined) {
      if (project.boardType === "KANBAN" || !data.sprintId) {
        status =
          (await getPrimaryBacklogStatusName(data.projectId)) ??
          (await getInitialStatusName(data.projectId));
      } else {
        status = await getInitialStatusName(data.projectId);
      }
    } else {
      const workflowStatuses = await getWorkflowStatuses(data.projectId);
      if (!workflowStatuses.some((s) => s.name === status)) {
        return { success: false, error: `"${status}" is not a status in this project's workflow.` };
      }
    }

    // The reporter is always the caller: it is an audit field, not an input.
    const reporterId = user.id;

    let order = data.order;
    if (order === undefined) {
      if (data.type === "EPIC") {
        order = 0;
      } else if (data.sprintId) {
        const maxSprintOrder = await prisma.issue.aggregate({
          where: {
            projectId: data.projectId,
            sprintId: data.sprintId,
            type: { not: "EPIC" },
          },
          _max: { order: true },
        });
        order = (maxSprintOrder._max.order ?? -1) + 1;
      } else {
        const backlogNames = await getBacklogStatusNames(data.projectId);
        const isBacklog = backlogNames.some(
          (b) => b.toLowerCase() === status.toLowerCase()
        );
        if (isBacklog) {
          const maxBacklogOrder = await prisma.issue.aggregate({
            where: {
              projectId: data.projectId,
              sprintId: null,
              status: { in: backlogNames },
              type: { not: "EPIC" },
            },
            _max: { order: true },
          });
          order = (maxBacklogOrder._max.order ?? -1) + 1;
        } else {
          const maxBoardOrder = await prisma.issue.aggregate({
            where: {
              projectId: data.projectId,
              sprintId: null,
              status,
              type: { not: "EPIC" },
            },
            _max: { order: true },
          });
          order = (maxBoardOrder._max.order ?? -1) + 1;
        }
      }
    }

    const newIssue = await createIssueWithKey(data.projectId, project.key, (key) =>
      prisma.issue.create({
        data: {
          key,
          title,
          description: data.description || "",
          type: data.type,
          priority: data.priority || "MEDIUM",
          status,
          order,
          storyPoints: data.storyPoints ?? null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          projectId: data.projectId,
          sprintId: data.sprintId || null,
          versionId: data.versionId || null,
          assigneeId: data.assigneeId || null,
          reporterId,
          parentId: data.parentId || null,
        },
        include: {
          assignee: USER_SELECT,
          reporter: USER_SELECT,
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
      })
    );

    await prisma.activityLog.create({
      data: {
        issueId: newIssue.id,
        userId: reporterId,
        action: "CREATED",
        field: "issue",
        newValue: newIssue.key,
      },
    });

    await notifyUsers(
      data.projectId,
      [data.assigneeId],
      {
        title: `You were assigned to ${newIssue.key}`,
        message: newIssue.title,
        link: issueLink(project.key, newIssue.key),
      },
      [reporterId]
    );

    const mentioned = await findMentionedUsers(data.projectId, data.description || "", {
      exclude: [reporterId, data.assigneeId],
    });

    if (mentioned.length > 0) {
      const snippet = (data.description || "").slice(0, 60);
      const ellipsis = (data.description || "").length > 60 ? "..." : "";

      await prisma.notification.createMany({
        data: mentioned.map((mUser) => ({
          userId: mUser.id,
          title: `Mentioned in ${newIssue.key}`,
          message: `You were mentioned in ${newIssue.key}: "${snippet}${ellipsis}"`,
          link: `/projects/${project.key}/board?selectedIssue=${newIssue.key}`,
        })),
      });

      await prisma.activityLog.createMany({
        data: mentioned.map((mUser) => ({
          issueId: newIssue.id,
          userId: reporterId,
          action: "MENTIONED",
          field: "description",
          newValue: mUser.name,
        })),
      });
    }

    revalidateProjectRoutes(project.key);

    triggerWebhooks("issue:created", newIssue, data.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      issueId: newIssue.id,
    });
    return { success: true as const, issue: newIssue };
  } catch (error) {
    return toActionError(error, "Failed to create issue");
  }
}

/**
 * Confirm that every record an issue is being linked to belongs to the same
 * project, and that an assignee is actually a member of it. Without this, ids
 * from another project could be attached by a caller that crafts the request.
 */
async function validateIssueRelations(
  projectId: string,
  links: {
    sprintId?: string | null;
    versionId?: string | null;
    parentId?: string | null;
    assigneeId?: string | null;
  }
): Promise<{ error?: string }> {
  if (links.sprintId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { boardType: true },
    });
    if (project?.boardType === "KANBAN") {
      return { error: "Kanban projects do not use sprints" };
    }
    const sprint = await prisma.sprint.findUnique({
      where: { id: links.sprintId },
      select: { projectId: true, status: true },
    });
    if (!sprint || sprint.projectId !== projectId) {
      return { error: "Sprint not found in this project" };
    }
    if (sprint.status === "COMPLETED") {
      return { error: "Cannot add items to finished sprints" };
    }
  }

  if (links.versionId) {
    const version = await prisma.version.findUnique({
      where: { id: links.versionId },
      select: { projectId: true },
    });
    if (!version || version.projectId !== projectId) {
      return { error: "Release version not found in this project" };
    }
  }

  if (links.parentId) {
    const parent = await prisma.issue.findUnique({
      where: { id: links.parentId },
      select: { projectId: true },
    });
    if (!parent || parent.projectId !== projectId) {
      return { error: "Parent issue not found in this project" };
    }
  }

  if (links.assigneeId) {
    const [membership, project] = await Promise.all([
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: links.assigneeId } },
        select: { userId: true },
      }),
      prisma.project.findUnique({ where: { id: projectId }, select: { leadId: true } }),
    ]);
    if (!membership && project?.leadId !== links.assigneeId) {
      return { error: "Assignee is not a member of this project" };
    }
  }

  return {};
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
    originalEstimateSeconds?: number | null;
    remainingEstimateSeconds?: number | null;
    startDate?: string | Date | null;
    dueDate?: string | Date | null;
    assigneeId?: string | null;
    sprintId?: string | null;
    versionId?: string | null;
    parentId?: string | null;
    /** Ignored: the actor is taken from the session. */
    updatedByUserId?: string;
  }
) {
  try {
    const projectId = await projectIdForIssue(id);
    const { user } = await requireProjectPermission(projectId, "EDIT_ISSUE");

    const existing = await prisma.issue.findUnique({
      where: { id },
      include: { project: true, assignee: USER_SELECT },
    });

    if (!existing) throw new Error("Issue not found");

    if (data.status !== undefined && data.status !== existing.status) {
      const allowed = await isTransitionAllowed(projectId, existing.status, data.status);
      if (!allowed) {
        return {
          success: false,
          error: `This project's workflow doesn't allow moving from "${existing.status}" to "${data.status}".`,
        };
      }
    }

    const willBeEpic = (data.type ?? existing.type) === "EPIC";
    if (willBeEpic && data.sprintId) {
      return { success: false, error: "Epics cannot be assigned to a sprint" };
    }

    if (existing.project.boardType === "KANBAN" && data.sprintId) {
      return { success: false, error: "Kanban projects do not use sprints" };
    }

    const related = await validateIssueRelations(projectId, {
      sprintId: data.sprintId !== existing.sprintId ? data.sprintId : null,
      versionId: data.versionId !== existing.versionId ? data.versionId : null,
      parentId: data.parentId !== existing.parentId ? data.parentId : null,
      assigneeId: data.assigneeId !== existing.assigneeId ? data.assigneeId : null,
    });
    if (related.error) return { success: false, error: related.error };

    if (data.parentId) {
      if (data.parentId === id) {
        return { success: false, error: "An issue cannot be its own parent" };
      }
      let checkParentId: string | null = data.parentId;
      while (checkParentId) {
        if (checkParentId === id) {
          return { success: false, error: "Cannot set a child or descendant as parent (circular hierarchy)" };
        }
        const p: { parentId: string | null } | null = await prisma.issue.findUnique({
          where: { id: checkParentId },
          select: { parentId: true },
        });
        checkParentId = p?.parentId ?? null;
      }
    }

    const actorId = user.id;

    // Setting an original estimate for the first time also seeds the
    // remaining estimate, so the time-tracking bar has something to show
    // before any work is logged. A later edit to either field is otherwise
    // independent -- Jira doesn't resync one from the other either.
    const shouldInitRemaining =
      data.originalEstimateSeconds !== undefined &&
      data.originalEstimateSeconds !== null &&
      existing.remainingEstimateSeconds === null &&
      data.remainingEstimateSeconds === undefined;

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.storyPoints !== undefined && { storyPoints: data.storyPoints }),
        ...(data.originalEstimateSeconds !== undefined && {
          originalEstimateSeconds: data.originalEstimateSeconds,
        }),
        ...(data.remainingEstimateSeconds !== undefined && {
          remainingEstimateSeconds: data.remainingEstimateSeconds,
        }),
        ...(shouldInitRemaining && { remainingEstimateSeconds: data.originalEstimateSeconds }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(willBeEpic
          ? (existing.sprintId ? { sprintId: null } : {})
          : (data.sprintId !== undefined && { sprintId: data.sprintId })),
        ...(data.versionId !== undefined && { versionId: data.versionId }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        assignee: USER_SELECT,
        reporter: USER_SELECT,
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
            assignee: USER_SELECT,
          },
        },
        ...RECENT_HISTORY_INCLUDE,
      },
    });

    // Record activity logs for the changes that actually happened.
    {
      if (data.status && data.status !== existing.status) {
        await prisma.activityLog.create({
          data: {
            issueId: id,
            userId: actorId,
            action: "STATUS_CHANGED",
            field: "status",
            oldValue: existing.status,
            newValue: data.status,
          },
        });

        await notifyStatusChange({
          issue: existing,
          projectKey: existing.project.key,
          from: existing.status,
          to: data.status,
          actorId,
        });
      }

      if (data.priority && data.priority !== existing.priority) {
        await prisma.activityLog.create({
          data: {
            issueId: id,
            userId: actorId,
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
            userId: actorId,
            action: "ASSIGNMENT_CHANGED",
            field: "assignee",
            oldValue: existing.assigneeId || "Unassigned",
            newValue: data.assigneeId || "Unassigned",
          },
        });

        await notifyUsers(
          projectId,
          [data.assigneeId],
          {
            title: `You were assigned to ${existing.key}`,
            message: existing.title,
            link: issueLink(existing.project.key, existing.key),
          },
          [actorId]
        );
      }

      // Notify project members newly mentioned in the description.
      if (
        data.description !== undefined &&
        data.description !== existing.description &&
        data.description
      ) {
        const mentioned = await findMentionedUsers(projectId, data.description, {
          exclude: [actorId, existing.assigneeId],
          previousText: existing.description,
        });

        if (mentioned.length > 0) {
          const snippet = data.description.slice(0, 60);
          const ellipsis = data.description.length > 60 ? "..." : "";

          await prisma.notification.createMany({
            data: mentioned.map((mUser) => ({
              userId: mUser.id,
              title: `Mentioned in ${existing.key}`,
              message: `You were mentioned in ${existing.key}: "${snippet}${ellipsis}"`,
              link: `/projects/${existing.project.key}/board?selectedIssue=${existing.key}`,
            })),
          });

          await prisma.activityLog.createMany({
            data: mentioned.map((mUser) => ({
              issueId: id,
              userId: actorId,
              action: "MENTIONED",
              field: "description",
              newValue: mUser.name,
            })),
          });
        }
      }
    }

    revalidateProjectRoutes(existing.project.key);

    const actor: WebhookActor = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };

    const changelog: WebhookChangelogItem[] = [];

    if (data.status !== undefined && data.status !== existing.status) {
      changelog.push({
        field: "status",
        fieldId: "status",
        from: existing.status,
        fromString: existing.status,
        to: updated.status,
        toString: updated.status,
      });
    }

    if (data.priority !== undefined && data.priority !== existing.priority) {
      changelog.push({
        field: "priority",
        fieldId: "priority",
        from: existing.priority,
        fromString: existing.priority,
        to: updated.priority,
        toString: updated.priority,
      });
    }

    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      changelog.push({
        field: "assignee",
        fieldId: "assignee",
        from: existing.assignee?.id || null,
        fromString: existing.assignee?.name || "Unassigned",
        to: updated.assignee?.id || null,
        toString: updated.assignee?.name || "Unassigned",
      });
    }

    if (data.title !== undefined && data.title !== existing.title) {
      changelog.push({
        field: "title",
        fieldId: "title",
        from: existing.title,
        fromString: existing.title,
        to: updated.title,
        toString: updated.title,
      });
    }

    if (data.type !== undefined && data.type !== existing.type) {
      changelog.push({
        field: "type",
        fieldId: "type",
        from: existing.type,
        fromString: existing.type,
        to: updated.type,
        toString: updated.type,
      });
    }

    if (data.storyPoints !== undefined && data.storyPoints !== existing.storyPoints) {
      changelog.push({
        field: "storyPoints",
        fieldId: "storyPoints",
        from: existing.storyPoints !== null ? String(existing.storyPoints) : null,
        fromString: existing.storyPoints !== null ? String(existing.storyPoints) : null,
        to: updated.storyPoints !== null ? String(updated.storyPoints) : null,
        toString: updated.storyPoints !== null ? String(updated.storyPoints) : null,
      });
    }

    if (data.status !== undefined && data.status !== existing.status) {
      triggerWebhooks(
        "issue:transitioned",
        { issue: updated, fromStatus: existing.status, toStatus: updated.status },
        existing.projectId,
        { actor, changelog, issueId: updated.id }
      );
    }

    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      triggerWebhooks(
        "issue:assigned",
        { issue: updated, previousAssignee: existing.assignee, newAssignee: updated.assignee },
        existing.projectId,
        { actor, changelog, issueId: updated.id }
      );
    }

    if (data.priority !== undefined && data.priority !== existing.priority) {
      triggerWebhooks(
        "issue:priority_changed",
        { issue: updated, fromPriority: existing.priority, toPriority: updated.priority },
        existing.projectId,
        { actor, changelog, issueId: updated.id }
      );
    }

    triggerWebhooks(
      "issue:updated",
      { issue: updated, changes: data },
      existing.projectId,
      { actor, changelog, issueId: updated.id }
    );
    return { success: true as const, issue: updated };
  } catch (error) {
    return toActionError(error, "Failed to update issue");
  }
}

/** Guards against a caller submitting an unreasonable reordering payload. */
const MAX_REORDER_BATCH = 500;

export async function updateIssueStatusAndOrder(
  issueId: string,
  newStatus: IssueStatus,
  newOrder: number,
  /** Ignored: the actor is taken from the session. */
  userId?: string,
  extraData?: {
    assigneeId?: string | null;
    parentId?: string | null;
    priority?: PriorityLevel;
    sprintId?: string | null;
  },
  /**
   * Every issue in the destination column, in the order the board now shows
   * them. Supplying it persists the whole column; without it only the moved
   * issue's position is stored, which leaves its neighbours on stale values and
   * lets the board rearrange itself on the next load.
   */
  orderedIssueIds?: string[]
) {
  try {
    const projectId = await projectIdForIssue(issueId);
    const { user } = await requireProjectPermission(projectId, "MOVE_ISSUE");
    const actorId = user.id;

    const existing = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });

    if (!existing) throw new Error("Issue not found");

    if (extraData) {
      const related = await validateIssueRelations(projectId, {
        parentId: extraData.parentId !== existing.parentId ? extraData.parentId : null,
        assigneeId:
          extraData.assigneeId !== existing.assigneeId ? extraData.assigneeId : null,
        sprintId:
          extraData.sprintId !== undefined && extraData.sprintId !== existing.sprintId
            ? extraData.sprintId
            : null,
      });
      if (related.error) return { success: false, error: related.error };
    }

    const statusChanged = existing.status !== newStatus;

    if (statusChanged) {
      const allowed = await isTransitionAllowed(projectId, existing.status, newStatus);
      if (!allowed) {
        return {
          success: false,
          error: `This project's workflow doesn't allow moving from "${existing.status}" to "${newStatus}".`,
        };
      }
    }

    // Reordering is confined to the project being edited, whatever ids the
    // caller supplies.
    const siblingIds = (orderedIssueIds ?? [])
      .filter((id) => id !== issueId)
      .slice(0, MAX_REORDER_BATCH);

    const validSiblingIds = siblingIds.length
      ? (
          await prisma.issue.findMany({
            where: { id: { in: siblingIds }, projectId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];

    const { resolvedOrder, siblingWrites } = planColumnOrder(
      issueId,
      orderedIssueIds,
      validSiblingIds,
      newOrder
    );

    const updatePayload: Record<string, any> = {
      status: newStatus,
      order: resolvedOrder,
    };

    if (extraData) {
      if (extraData.assigneeId !== undefined) {
        updatePayload.assigneeId = extraData.assigneeId;
      }
      if (extraData.parentId !== undefined) {
        updatePayload.parentId = extraData.parentId;
      }
      if (extraData.priority !== undefined) {
        updatePayload.priority = extraData.priority;
      }
      if (extraData.sprintId !== undefined) {
        if (existing.type !== "EPIC" || extraData.sprintId === null) {
          updatePayload.sprintId = extraData.sprintId;
        }
      }
    }

    // The moved issue and its new neighbours are written together: a partial
    // write would leave the column in an order nobody asked for.
    const [updated] = await prisma.$transaction([
      prisma.issue.update({
        where: { id: issueId },
        data: updatePayload,
        include: {
          project: true,
          assignee: USER_SELECT,
          reporter: USER_SELECT,
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
      }),
      ...siblingWrites.map(({ id, order }) =>
        prisma.issue.update({ where: { id }, data: { order } })
      ),
    ]);

    if (statusChanged) {
      await prisma.activityLog.create({
        data: {
          issueId,
          userId: actorId,
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: existing.status,
          newValue: newStatus,
        },
      });

      await notifyStatusChange({
        issue: existing,
        projectKey: existing.project.key,
        from: existing.status,
        to: newStatus,
        actorId,
      });
    }

    revalidateProjectRoutes(existing.project.key);

    const actor: WebhookActor = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
    const changelog: WebhookChangelogItem[] = [];

    if (existing.status !== newStatus) {
      changelog.push({
        field: "status",
        fieldId: "status",
        from: existing.status,
        fromString: existing.status,
        to: newStatus,
        toString: newStatus,
      });

      triggerWebhooks(
        "issue:transitioned",
        { issue: updated, fromStatus: existing.status, toStatus: newStatus },
        existing.projectId,
        { actor, changelog, issueId: updated.id }
      );
    }

    triggerWebhooks(
      "issue:updated",
      { issueId, key: existing.key, status: newStatus, order: newOrder },
      existing.projectId,
      { actor, changelog, issueId: updated.id }
    );
    return { success: true as const, issue: updated };
  } catch (error) {
    return toActionError(error, "Failed to update issue position");
  }
}

export async function deleteIssue(id: string) {
  try {
    const projectId = await projectIdForIssue(id);
    const auth = await requireProjectPermission(projectId, "DELETE_ISSUE");
    const { user } = auth;

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!issue) throw new Error("Issue not found");

    // An issue belongs to its reporter; project administrators can delete any issue.
    if (issue.reporterId !== user.id && !(await canModerateProject(auth))) {
      return {
        success: false as const,
        error: "Only project administrators or the issue's reporter can delete this issue.",
      };
    }

    await prisma.issue.delete({ where: { id } });
    // Attachment rows cascade with the issue; their files on disk don't.
    await deleteIssueAttachmentDir(id);

    revalidateProjectRoutes(issue.project.key);

    triggerWebhooks(
      "issue:deleted",
      { id: issue.id, key: issue.key, title: issue.title },
      issue.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        issueId: issue.id,
      }
    );
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete issue");
  }
}

const MAX_BULK_BATCH = 200;

export interface BulkActionResult {
  success: true;
  succeeded: number;
  /** Per-issue failures (e.g. a disallowed status transition, or no permission on that issue's project). */
  failed: { id: string; error: string }[];
}

/**
 * Applies the same field changes to many issues at once, reusing updateIssue's
 * per-issue permission and workflow-transition checks rather than a bulk
 * write -- a selection can span multiple projects (or, for status, several
 * different workflows), so each issue is validated on its own terms.
 */
export async function bulkUpdateIssues(
  issueIds: string[],
  changes: {
    status?: IssueStatus;
    assigneeId?: string | null;
    priority?: PriorityLevel;
    versionId?: string | null;
  }
): Promise<BulkActionResult | { success: false; error: string }> {
  const ids = Array.from(new Set(issueIds));
  if (ids.length === 0) return { success: true, succeeded: 0, failed: [] };
  if (ids.length > MAX_BULK_BATCH) {
    return { success: false, error: `Select at most ${MAX_BULK_BATCH} issues at a time.` };
  }

  const failed: { id: string; error: string }[] = [];
  let succeeded = 0;

  for (const id of ids) {
    const res = await updateIssue(id, changes);
    if (res.success) {
      succeeded++;
    } else {
      failed.push({ id, error: res.error || "Failed to update" });
    }
  }

  return { success: true, succeeded, failed };
}

export async function bulkDeleteIssues(issueIds: string[]): Promise<BulkActionResult | { success: false; error: string }> {
  const ids = Array.from(new Set(issueIds));
  if (ids.length === 0) return { success: true, succeeded: 0, failed: [] };
  if (ids.length > MAX_BULK_BATCH) {
    return { success: false, error: `Select at most ${MAX_BULK_BATCH} issues at a time.` };
  }

  const failed: { id: string; error: string }[] = [];
  let succeeded = 0;

  for (const id of ids) {
    const res = await deleteIssue(id);
    if (res.success) {
      succeeded++;
    } else {
      failed.push({ id, error: res.error || "Failed to delete" });
    }
  }

  return { success: true, succeeded, failed };
}

