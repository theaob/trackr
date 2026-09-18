import React from "react";
import { getProjectByKey } from "@/lib/actions/projects";
import { getEpicRoadmap } from "@/lib/actions/roadmap";
import RoadmapView from "@/components/roadmap/RoadmapView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
}

export default async function RoadmapPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/roadmap`);

  const epics = await getEpicRoadmap(project.id);

  return <RoadmapView project={project as any} epics={epics as any} />;
}
