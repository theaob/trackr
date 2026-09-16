import React from "react";
import { notFound } from "next/navigation";
import { getProjects, getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectEpics } from "@/lib/actions/issues";
import ProjectLayoutClient from "@/components/layout/ProjectLayoutClient";
import { requirePageUser } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectKey: string };
}) {
  await requirePageUser();

  // getProjectByKey returns null when the caller has no membership, so an
  // inaccessible project is indistinguishable from one that does not exist.
  const currentProject = await getProjectByKey(params.projectKey);
  if (!currentProject) {
    notFound();
  }

  const [projects, users, sprints, epics] = await Promise.all([
    getProjects(),
    getProjectUsers(currentProject.id),
    getProjectSprints(currentProject.id),
    // Epics only: the layout used to load 200 issues with their comment and
    // activity threads just to filter this list out of them.
    getProjectEpics(currentProject.id),
  ]);

  return (
    <ProjectLayoutClient
      projects={projects as any}
      currentProject={currentProject as any}
      users={users as any}
      sprints={sprints as any}
      epics={epics as any}
    >
      {children}
    </ProjectLayoutClient>
  );
}
