"use server";

import prisma from "@/lib/db";
import { VersionStatus } from "@/types";
import { revalidatePath } from "next/cache";
import { triggerWebhooks } from "./webhooks";


export async function getProjectVersions(projectId: string) {
  try {
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

    return versions.map((v) => {
      const total = v.issues.length;
      let done = 0;
      let inProgress = 0;
      let todo = 0;
      let storyPoints = 0;
      let completedStoryPoints = 0;

      for (const issue of v.issues) {
        const pts = issue.storyPoints || 0;
        storyPoints += pts;

        if (issue.status === "DONE") {
          done++;
          completedStoryPoints += pts;
        } else if (issue.status === "IN_PROGRESS" || issue.status === "IN_REVIEW") {
          inProgress++;
        } else {
          todo++;
        }
      }

      const { issues, ...rest } = v;
      return {
        ...rest,
        issueCount: {
          total,
          done,
          inProgress,
          todo,
          storyPoints,
          completedStoryPoints,
        },
      };
    });
  } catch (error) {
    console.error("Failed to fetch project versions:", error);
    return [];
  }
}

export async function getVersionById(id: string) {
  try {
    return await prisma.version.findUnique({
      where: { id },
      include: {
        project: true,
        issues: {
          include: {
            assignee: true,
            reporter: true,
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
}) {
  try {
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

    try {
      revalidatePath(`/projects/${project.key}/releases`);
    } catch {}
    return { success: true, version };
  } catch (error) {
    console.error("Failed to create version:", error);
    return { success: false, error: "Failed to create version" };
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
  }
) {
  try {
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

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
    } catch {}
    return { success: true, version: updated };
  } catch (error) {
    console.error("Failed to update version:", error);
    return { success: false, error: "Failed to update version" };
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
    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    const releaseDate = data.releaseDate ? new Date(data.releaseDate) : new Date();

    // Move unresolved issues if specified
    if (data.moveUnresolvedToVersionId !== undefined) {
      await prisma.issue.updateMany({
        where: {
          versionId: id,
          status: { not: "DONE" },
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

    triggerWebhooks("version:released", updated, existing.projectId);
    return { success: true, version: updated };
  } catch (error) {
    console.error("Failed to release version:", error);
    return { success: false, error: "Failed to release version" };
  }
}


export async function archiveVersion(id: string, archive: boolean) {
  try {
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
    return { success: true, version: updated };
  } catch (error) {
    console.error("Failed to archive version:", error);
    return { success: false, error: "Failed to archive version" };
  }
}

export async function deleteVersion(id: string) {
  try {
    const existing = await prisma.version.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) throw new Error("Version not found");

    await prisma.version.delete({ where: { id } });

    try {
      revalidatePath(`/projects/${existing.project.key}/releases`);
    } catch {}
    return { success: true };
  } catch (error) {
    console.error("Failed to delete version:", error);
    return { success: false, error: "Failed to delete version" };
  }
}

export async function getVersionReleaseNotesData(versionId: string) {
  try {
    const version = await prisma.version.findUnique({
      where: { id: versionId },
      include: {
        project: true,
        issues: {
          include: {
            assignee: true,
            reporter: true,
          },
          orderBy: [{ type: "asc" }, { key: "asc" }],
        },
      },
    });

    if (!version) return null;

    const features = version.issues.filter((i) => i.type === "STORY" || i.type === "TASK");
    const bugs = version.issues.filter((i) => i.type === "BUG");
    const technical = version.issues.filter((i) => i.type === "SUBTASK" || i.type === "EPIC");

    // Collect contributors
    const contributorMap = new Map<string, { name: string; email: string; avatarUrl?: string | null }>();
    for (const i of version.issues) {
      if (i.assignee) {
        contributorMap.set(i.assignee.id, {
          name: i.assignee.name,
          email: i.assignee.email,
          avatarUrl: i.assignee.avatarUrl,
        });
      }
      if (i.reporter) {
        contributorMap.set(i.reporter.id, {
          name: i.reporter.name,
          email: i.reporter.email,
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
