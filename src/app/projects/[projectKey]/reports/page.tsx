import React from "react";
import { getProjectByKey } from "@/lib/actions/projects";
import { getReportableSprints, getSprintReport, getProjectVelocity } from "@/lib/actions/reports";
import ReportsView from "@/components/reports/ReportsView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
}

export default async function ReportsPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/reports`);

  const [sprints, velocity] = await Promise.all([
    getReportableSprints(project.id),
    getProjectVelocity(project.id),
  ]);

  // Default to the active sprint; failing that, the most recently started
  // completed one (sprints are already ordered newest-start first).
  const defaultSprint = sprints.find((s) => s.status === "ACTIVE") ?? sprints[0] ?? null;
  const initialReport = defaultSprint ? await getSprintReport(defaultSprint.id) : null;

  return (
    <ReportsView
      project={project as any}
      sprints={sprints as any}
      initialSprintId={defaultSprint?.id ?? null}
      initialReport={initialReport as any}
      velocity={velocity as any}
    />
  );
}
