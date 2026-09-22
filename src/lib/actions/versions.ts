"use server";

import prisma from "@/lib/db";
import { VersionStatus } from "@/types";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";
import { DISPLAY_USER_SELECT } from "@/lib/auth/publicUser";
import {
  projectIdForVersion,
  requireProjectAccess,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { getDoneStatusNames, getStatusCategoryMap } from "@/lib/workflow";
import { computeVersionStats } from "@/lib/versionStats";
import { compareIssueKeys } from "@/lib/issueKeys";

export async function getProjectVersions(projectId: string) {
  try {
    await requireProjectAccess(projectId);

    const versions = await prisma.version.findMany({
      where: { projectId },
      include: {
        project: true,
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
      },
      orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }],
    });

    const categoryByStatus = await getStatusCategoryMap(projectId);

    return versions.map((v) => computeVersionStats(v, categoryByStatus));
  } catch (error) {
    console.error("Failed to fetch project versions:", error);
    return [];
  }
}

export async function getVersionById(id: string) {
  try {
    await requireProjectAccess(await projectIdForVersion(id));

    return await prisma.version.findUnique({
      where: { id },
      include: {
        project: true,
        issues: {
          include: {
            assignee: { select: DISPLAY_USER_SELECT },
            reporter: { select: DISPLAY_USER_SELECT },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch version:", error);
    return null;
  }
}

export async function createVersion(data: {
  projectId: string;
  name: string;
  description?: string;
  startDate?: string | Date | null;
  releaseDate?: string | Date | null;
  issueIds?: string[];
}) {
  try {
    const { user } = await requireProjectPermission(data.projectId, "MANAGE_VERSIONS");

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { key: true },
    });
    if (!project) throw new Error("Project not found");

    const version = await prisma.version.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        projectId: data.projectId,
        status: "UNRELEASED",
      },
    });

    if (data.issueIds && data.issueIds.length > 0) {
      await prisma.issue.updateMany({
        where: {
          id: { in: data.issueIds },
          projectId: data.projectId,
        },
        data: {
          versionId: version.id,
        },
      });
    }

    try {
      revalidatePath(`/projects/${project.key}/releases`);
      revalidatePath(`/projects/${project.key}/board`);
      revalidatePath(`/projects/${project.key}/backlog`);
      revalidatePath(`/projects/${project.key}/issues`);
    } catch {}

    triggerWebhooks("version:created", version, data.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });

    const categoryByStatus = await getStatusCategoryMap(data.projectId);
    const versionWithIssues = await prisma.version.findUnique({
      where: { id: version.id },
      include: {
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });

    const formatted = versionWithIssues
      ? computeVersionStats(versionWithIssues, categoryByStatus)
      : version;

    return { success: true as const, version: formatted };
  } catch (error) {
    return toActionError(error, "Failed to create version");
  }
}

export async function updateVersion(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    startDate?: string | Date | null;
    releaseDate?: string | Date | null;
    status?: VersionStatus;
    issueIds?: string[];
  }
) {
  try {
    const projectId = await projectIdForVersion(id);
    const { user } = await requireProjectPermission(projectId, "MANAGE_VERSIONS");

    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    const updated = await prisma.version.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.releaseDate !== undefined && {
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    if (data.issueIds !== undefined) {
      // Unassign issues that were previously in this version but not in new list
      await prisma.issue.updateMany({
        where: {
          versionId: id,
          id: { notIn: data.issueIds },
        },
        data: {
          versionId: null,
        },
      });

      // Assign newly selected issues
      if (data.issueIds.length > 0) {
        await prisma.issue.updateMany({
          where: {
            id: { in: data.issueIds },
            projectId: existing.projectId,
          },
          data: {
            versionId: id,
          },
        });
      }
    }

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
      revalidatePath(`/projects/${existing.project.key}/board`);
      revalidatePath(`/projects/${existing.project.key}/backlog`);
      revalidatePath(`/projects/${existing.project.key}/issues`);
    } catch {}

    triggerWebhooks("version:updated", updated, existing.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });

    const categoryByStatus = await getStatusCategoryMap(existing.projectId);
    const versionWithIssues = await prisma.version.findUnique({
      where: { id: updated.id },
      include: {
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });

    const formatted = versionWithIssues
      ? computeVersionStats(versionWithIssues, categoryByStatus)
      : updated;

    return { success: true as const, version: formatted };
  } catch (error) {
    return toActionError(error, "Failed to update version");
  }
}

export async function getReleaseEligibleIssues(projectId: string, currentVersionId?: string) {
  try {
    await requireProjectAccess(projectId);

    const [issues, sprints, categoryByStatus] = await Promise.all([
      prisma.issue.findMany({
        where: { projectId },
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          type: true,
          storyPoints: true,
          versionId: true,
          version: { select: { id: true, name: true, status: true } },
          sprintId: true,
          sprint: { select: { id: true, name: true, status: true } },
        },
      }),
      prisma.sprint.findMany({
        where: { projectId },
        select: { id: true, name: true, status: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      getStatusCategoryMap(projectId),
    ]);

    return {
      // SQL's ORDER BY key sorts the number as text (APOLLO-10 before
      // APOLLO-2), so the numeric ordering is done here instead.
      issues: issues
        .slice()
        .sort((a, b) => compareIssueKeys(a.key, b.key))
        .map((i) => ({
          ...i,
          category: categoryByStatus.get(i.status) || "TODO",
          isAssignedToCurrent: currentVersionId ? i.versionId === currentVersionId : false,
        })),
      sprints,
    };
  } catch (error) {
    console.error("Failed to fetch release eligible issues:", error);
    return { issues: [], sprints: [] };
  }
}

export async function addIssuesToVersion(versionId: string, issueIds: string[]) {
  try {
    const projectId = await projectIdForVersion(versionId);
    await requireProjectPermission(projectId, "MANAGE_VERSIONS");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });
    if (!project) throw new Error("Project not found");

    if (issueIds.length > 0) {
      await prisma.issue.updateMany({
        where: {
          id: { in: issueIds },
          projectId,
        },
        data: {
          versionId,
        },
      });
    }

    try {
      revalidatePath(`/projects/${project.key}/releases`);
      revalidatePath(`/projects/${project.key}/board`);
      revalidatePath(`/projects/${project.key}/backlog`);
      revalidatePath(`/projects/${project.key}/issues`);
    } catch {}

    const categoryByStatus = await getStatusCategoryMap(projectId);
    const updatedVersion = await prisma.version.findUnique({
      where: { id: versionId },
      include: {
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });

    return {
      success: true as const,
      version: updatedVersion ? computeVersionStats(updatedVersion, categoryByStatus) : null,
    };
  } catch (error) {
    return toActionError(error, "Failed to add issues to version");
  }
}

export async function removeIssueFromVersion(issueId: string) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue) throw new Error("Issue not found");

    await requireProjectPermission(issue.projectId, "MANAGE_VERSIONS");

    const previousVersionId = issue.versionId;

    await prisma.issue.update({
      where: { id: issueId },
      data: { versionId: null },
    });

    try {
      revalidatePath(`/projects/${issue.project.key}/releases`);
      revalidatePath(`/projects/${issue.project.key}/board`);
      revalidatePath(`/projects/${issue.project.key}/backlog`);
      revalidatePath(`/projects/${issue.project.key}/issues`);
    } catch {}

    let updatedVersion = null;
    if (previousVersionId) {
      const categoryByStatus = await getStatusCategoryMap(issue.projectId);
      const v = await prisma.version.findUnique({
        where: { id: previousVersionId },
        include: {
          issues: {
            select: {
              id: true,
              status: true,
              storyPoints: true,
            },
          },
        },
      });
      if (v) {
        updatedVersion = computeVersionStats(v, categoryByStatus);
      }
    }

    return { success: true as const, version: updatedVersion };
  } catch (error) {
    return toActionError(error, "Failed to remove issue from version");
  }
}

export async function getVersionIssues(versionId: string) {
  try {
    const projectId = await projectIdForVersion(versionId);
    await requireProjectAccess(projectId);

    const issues = await prisma.issue.findMany({
      where: { versionId },
      include: {
        assignee: { select: DISPLAY_USER_SELECT },
        reporter: { select: DISPLAY_USER_SELECT },
      },
    });

    const categoryByStatus = await getStatusCategoryMap(projectId);

    // SQL's ORDER BY key sorts the number as text (APOLLO-10 before
    // APOLLO-2), so the numeric ordering is done here instead.
    return issues
      .slice()
      .sort((a, b) => compareIssueKeys(a.key, b.key))
      .map((i) => ({
        ...i,
        category: categoryByStatus.get(i.status) || "TODO",
      }));
  } catch (error) {
    console.error("Failed to fetch version issues:", error);
    return [];
  }
}

export async function releaseVersion(
  id: string,
  data: {
    releaseDate?: string | Date | null;
    moveUnresolvedToVersionId?: string | null;
  }
) {
  try {
    const projectId = await projectIdForVersion(id);
    const { user } = await requireProjectPermission(projectId, "MANAGE_VERSIONS");

    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    if (data.moveUnresolvedToVersionId) {
      const target = await prisma.version.findUnique({
        where: { id: data.moveUnresolvedToVersionId },
        select: { projectId: true },
      });
      if (!target || target.projectId !== projectId) {
        return { success: false, error: "Target version not found in this project" };
      }
    }

    const releaseDate = data.releaseDate ? new Date(data.releaseDate) : new Date();

    // Move unresolved issues if specified
    if (data.moveUnresolvedToVersionId !== undefined) {
      const doneNames = await getDoneStatusNames(projectId);
      await prisma.issue.updateMany({
        where: {
          versionId: id,
          status: { notIn: doneNames },
        },
        data: {
          versionId: data.moveUnresolvedToVersionId || null,
        },
      });
    }

    const updated = await prisma.version.update({
      where: { id },
      data: {
        status: "RELEASED",
        releaseDate,
      },
    });

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
    } catch {}

    triggerWebhooks("version:released", updated, existing.projectId, {
      actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
    return { success: true as const, version: updated };
  } catch (error) {
    return toActionError(error, "Failed to release version");
  }
}


export async function archiveVersion(id: string, archive: boolean) {
  try {
    const { user } = await requireProjectPermission(await projectIdForVersion(id), "MANAGE_VERSIONS");

    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    const newStatus: VersionStatus = archive ? "ARCHIVED" : "UNRELEASED";

    const updated = await prisma.version.update({
      where: { id },
      data: { status: newStatus },
    });

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
    } catch {}

    triggerWebhooks(
      archive ? "version:archived" : "version:updated",
      updated,
      existing.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      }
    );

    return { success: true as const, version: updated };
  } catch (error) {
    return toActionError(error, "Failed to archive version");
  }
}

export async function deleteVersion(id: string) {
  try {
    const { user } = await requireProjectPermission(await projectIdForVersion(id), "MANAGE_VERSIONS");

    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    await prisma.version.delete({ where: { id } });

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
    } catch {}

    triggerWebhooks(
      "version:deleted",
      { id: existing.id, name: existing.name, projectId: existing.projectId },
      existing.projectId,
      {
        actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      }
    );

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete version");
  }
}

export async function getVersionReleaseNotesData(versionId: string) {
  try {
    await requireProjectAccess(await projectIdForVersion(versionId));

    const version = await prisma.version.findUnique({
      where: { id: versionId },
      include: {
        project: true,
        issues: {
          include: {
            assignee: { select: DISPLAY_USER_SELECT },
            reporter: { select: DISPLAY_USER_SELECT },
          },
        },
      },
    });

    if (!version) return null;

    // SQL's ORDER BY key sorts the number as text (APOLLO-10 before
    // APOLLO-2), so the numeric ordering is done here instead. Each
    // type-filtered bucket below only needs to be key-ordered within
    // itself, which a plain sort by key guarantees regardless of how the
    // types interleave.
    version.issues.sort((a, b) => compareIssueKeys(a.key, b.key));

    const features = version.issues.filter((i) => i.type === "STORY" || i.type === "TASK");
    const bugs = version.issues.filter((i) => i.type === "BUG");
    const technical = version.issues.filter((i) => i.type === "SUBTASK" || i.type === "EPIC");

    // Collect contributors. Release notes credit people by name; their email
    // addresses are not needed and would travel to anyone who can read the
    // project, including visitors to a published one.
    const contributorMap = new Map<string, { name: string; avatarUrl?: string | null }>();
    for (const i of version.issues) {
      if (i.assignee) {
        contributorMap.set(i.assignee.id, {
          name: i.assignee.name,
          avatarUrl: i.assignee.avatarUrl,
        });
      }
      if (i.reporter) {
        contributorMap.set(i.reporter.id, {
          name: i.reporter.name,
          avatarUrl: i.reporter.avatarUrl,
        });
      }
    }

    const contributors = Array.from(contributorMap.values());

    // Generate standard markdown
    const releaseDateStr = version.releaseDate
      ? new Date(version.releaseDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    let markdown = `# Release ${version.name} (${releaseDateStr})\n\n`;
    if (version.description) {
      markdown += `> ${version.description}\n\n`;
    }

    if (features.length > 0) {
      markdown += `### 🚀 Features & Enhancements\n`;
      for (const issue of features) {
        const points = issue.storyPoints ? ` (${issue.storyPoints} pts)` : "";
        const assignee = issue.assignee ? ` - @${issue.assignee.name}` : "";
        markdown += `- **[${issue.key}]** ${issue.title}${points}${assignee}\n`;
      }
      markdown += `\n`;
    }

    if (bugs.length > 0) {
      markdown += `### 🐛 Bug Fixes\n`;
      for (const issue of bugs) {
        const assignee = issue.assignee ? ` - @${issue.assignee.name}` : "";
        markdown += `- **[${issue.key}]** ${issue.title}${assignee}\n`;
      }
      markdown += `\n`;
    }

    if (technical.length > 0) {
      markdown += `### 🛠️ Technical Improvements & Subtasks\n`;
      for (const issue of technical) {
        markdown += `- **[${issue.key}]** ${issue.title}\n`;
      }
      markdown += `\n`;
    }

    if (contributors.length > 0) {
      markdown += `### 👥 Contributors\n`;
      markdown += contributors.map((c) => `- ${c.name}`).join("\n");
      markdown += `\n`;
    }

    return {
      version,
      features,
      bugs,
      technical,
      contributors,
      markdown,
    };
  } catch (error) {
    console.error("Failed to generate release notes data:", error);
    return null;
  }
}
