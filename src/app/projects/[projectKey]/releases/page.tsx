import React from "react";
import { getProjectByKey } from "@/lib/actions/projects";
import { getProjectVersions } from "@/lib/actions/versions";
import ReleasesView from "@/components/releases/ReleasesView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
}

export default async function ReleasesPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/releases`);

  const versions = await getProjectVersions(project.id);

  return <ReleasesView project={project as any} initialVersions={versions as any} />;
}
