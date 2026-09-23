import React from "react";
import { getProjects, getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getSprintOptions } from "@/lib/actions/sprints";
import { getProjectEpics } from "@/lib/actions/issues";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import ProjectLayoutClient from "@/components/layout/ProjectLayoutClient";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  // getProjectByKey returns null when the caller has no membership, so an
  // inaccessible project is indistinguishable from one that does not exist.
  const currentProject = await getProjectByKey(projectKey);
  if (!currentProject) return denyPageAccess(`/projects/${projectKey}/board`);

  const [projects, users, sprints, epics, workflow] = await Promise.all([
    getProjects(),
    getProjectUsers(currentProject.id),
    // Open sprints only, without issues: the create-issue dialog just needs
    // a dropdown, and this runs on every page in the project.
    getSprintOptions(currentProject.id),
    // Epics only: the layout used to load 200 issues with their comment and
    // activity threads just to filter this list out of them.
    getProjectEpics(currentProject.id),
    getProjectWorkflow(currentProject.id),
  ]);

  return (
    <ProjectLayoutClient
      projects={projects as any}
      currentProject={currentProject as any}
      users={users as any}
      sprints={sprints as any}
      epics={epics as any}
      statuses={workflow.statuses.map((s) => ({ name: s.name, color: s.color }))}
    >
      {children}
    </ProjectLayoutClient>
  );
}
