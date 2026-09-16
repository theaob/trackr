import React from "react";
import { notFound } from "next/navigation";
import { getProjects, getProjectByKey, getAllUsers } from "@/lib/actions/projects";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectIssues } from "@/lib/actions/issues";
import ProjectLayoutClient from "@/components/layout/ProjectLayoutClient";
import { Issue } from "@/types";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectKey: string };
}) {
  const currentProject = await getProjectByKey(params.projectKey);
  if (!currentProject) {
    notFound();
  }

  const [projects, users, sprints, issues] = await Promise.all([
    getProjects(),
    getAllUsers(),
    getProjectSprints(currentProject.id),
    getProjectIssues(currentProject.id),
  ]);

  const epics = (issues as Issue[]).filter((i) => i.type === "EPIC");

  return (
    <ProjectLayoutClient
      projects={projects as any}
      currentProject={currentProject as any}
      users={users as any}
      sprints={sprints as any}
      epics={epics}
    >
      {children}
    </ProjectLayoutClient>
  );
}
