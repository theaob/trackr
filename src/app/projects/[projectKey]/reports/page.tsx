import React from "react";
import { getProjectByKey } from "@/lib/actions/projects";
import {
  getReportableSprints,
  getSprintReport,
  getProjectVelocity,
  getCumulativeFlowReport,
  getProjectDistribution,
  getEpicProgressReport,
} from "@/lib/actions/reports";
import ReportsView from "@/components/reports/ReportsView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
}

export default async function ReportsPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/reports`);

  const [sprints, velocity, cfd, epics] = await Promise.all([
    getReportableSprints(project.id),
    getProjectVelocity(project.id),
    getCumulativeFlowReport(project.id, 30),
    getEpicProgressReport(project.id),
  ]);

  const defaultSprint = sprints.find((s) => s.status === "ACTIVE") ?? sprints[0] ?? null;
  const [initialReport, initialDistribution] = await Promise.all([
    defaultSprint ? getSprintReport(defaultSprint.id) : Promise.resolve(null),
    getProjectDistribution(project.id, defaultSprint?.id ?? null),
  ]);

  return (
    <ReportsView
      project={project as any}
      sprints={sprints as any}
      initialSprintId={defaultSprint?.id ?? null}
      initialReport={initialReport as any}
      velocity={velocity as any}
      initialCfd={cfd as any}
      initialDistribution={initialDistribution as any}
      initialEpics={epics as any}
    />
  );
}
