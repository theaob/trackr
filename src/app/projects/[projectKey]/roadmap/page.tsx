import React from "react";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getEpicRoadmap } from "@/lib/actions/roadmap";
import RoadmapView from "@/components/roadmap/RoadmapView";
import { denyPageAccess } from "@/lib/auth/page";
import { redirect } from "next/navigation";
import { legacyIssueRedirect } from "@/lib/issueUrls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selectedIssue?: string; issue?: string }>;
}

export default async function RoadmapPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const query = await searchParams;
  // Links from before issues had their own page open that page instead.
  const legacyIssue = legacyIssueRedirect(projectKey, query);
  if (legacyIssue) redirect(legacyIssue);
  const project = await getProjectByKey(projectKey);
  if (!project) return denyPageAccess(`/projects/${projectKey}/roadmap`);

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
    />
  );
}
