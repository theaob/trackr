import React from "react";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getEpicRoadmap } from "@/lib/actions/roadmap";
import RoadmapView from "@/components/roadmap/RoadmapView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
  searchParams?: { selectedIssue?: string; issue?: string };
}

export default async function RoadmapPage({ params, searchParams }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/roadmap`);

  const [epics, users, sprints, versions] = await Promise.all([
    getEpicRoadmap(project.id),
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectVersions(project.id),
  ]);

  return (
    <RoadmapView
      project={project as any}
      epics={epics as any}
      users={users as any}
      sprints={sprints as any}
      versions={versions as any}
      initialSelectedIssueKey={searchParams?.selectedIssue || searchParams?.issue}
    />
  );
}
