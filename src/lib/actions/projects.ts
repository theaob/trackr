"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getProjects() {
  try {
    return await prisma.project.findMany({
      include: {
        lead: true,
        members: {
          select: { userId: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return [];
  }
}

export async function getProjectByKey(key: string) {
  try {
    return await prisma.project.findUnique({
      where: { key: key.toUpperCase() },
      include: {
        lead: true,
        members: {
          select: { userId: true, role: true },
        },
        sprints: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    console.error(`Failed to fetch project with key ${key}:`, error);
    return null;
  }
}

export async function getAllUsers() {
  try {
    return await prisma.user.findMany({
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export async function createProject(data: {
  name: string;
  key: string;
  description?: string;
  category?: string;
  leadId?: string;
}) {
  try {
    const formattedKey = data.key.trim().toUpperCase();
    if (!formattedKey.match(/^[A-Z0-9]{2,10}$/)) {
      return {
        success: false,
        error: "Project key must be 2-10 alphanumeric uppercase characters.",
      };
    }

    const existing = await prisma.project.findUnique({
      where: { key: formattedKey },
    });
    if (existing) {
      return { success: false, error: `A project with key ${formattedKey} already exists.` };
    }

    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        key: formattedKey,
        description: data.description || "",
        category: data.category || "Software Development",
        leadId: data.leadId || null,
        sprints: {
          create: {
            name: "Sprint 1",
            status: "FUTURE",
            goal: "Initial sprint planning and setup.",
          },
        },
      },
      include: {
        lead: true,
      },
    });

    try {
      revalidatePath("/projects");
    } catch {}
    return { success: true, project };
  } catch (error) {
    console.error("Failed to create project:", error);
    return { success: false, error: "Failed to create project" };
  }
}

export async function getAllProjectsWithStats() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        lead: true,
        members: {
          select: { userId: true, role: true },
        },
        issues: {
          select: { id: true, status: true },
        },
        sprints: {
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      category: p.category,
      lead: p.lead,
      leadId: p.leadId,
      members: p.members,
      totalIssues: p.issues.length,
      openIssues: p.issues.filter((i) => i.status !== "DONE").length,
      activeSprint: p.sprints.length > 0 ? p.sprints[0].name : null,
    }));
  } catch (error) {
    console.error("Failed to fetch projects with stats:", error);
    return [];
  }
}

export async function updateProject(id: string, data: { name?: string; description?: string }) {
  try {
    const updated = await prisma.project.update({
      where: { id },
      data,
    });
    try {
      revalidatePath(`/projects/${updated.key}`);
    } catch {}
    return { success: true, project: updated };
  } catch (error) {
    console.error("Failed to update project:", error);
    return { success: false, error: "Failed to update project" };
  }
}
