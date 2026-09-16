import React from "react";
import { notFound } from "next/navigation";
import { getProjectByKey } from "@/lib/actions/projects";
import { getProjectVersions } from "@/lib/actions/versions";
import ReleasesView from "@/components/releases/ReleasesView";

interface PageProps {
  params: { projectKey: string };
}

export default async function ReleasesPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) notFound();

  const versions = await getProjectVersions(project.id);

  return <ReleasesView project={project as any} initialVersions={versions as any} />;
}
