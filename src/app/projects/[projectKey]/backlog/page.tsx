import React, { Suspense } from "react";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getBacklogIssues, getProjectEpics } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import BacklogView from "@/components/backlog/BacklogView";
import { denyPageAccess } from "@/lib/auth/page";
import { redirect } from "next/navigation";
import { legacyIssueRedirect } from "@/lib/issueUrls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selectedIssue?: string; issue?: string }>;
}

export default async function BacklogPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const query = await searchParams;
  // Links from before issues had their own page open that page instead.
  const legacyIssue = legacyIssueRedirect(projectKey, query);
  if (legacyIssue) redirect(legacyIssue);
  const project = await getProjectByKey(projectKey);
  if (!project) return denyPageAccess(`/projects/${projectKey}/backlog`);

  const [issues, users, sprints, workflow, epics, versions] = await Promise.all([
    getBacklogIssues(project.id),
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectWorkflow(project.id),
    getProjectEpics(project.id),
    getProjectVersions(project.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted">Loading backlog...</div>}>
      <BacklogView
        project={project as any}
        initialIssues={issues as any}
        users={users as any}
        initialSprints={sprints as any}
        versions={versions as any}
        statuses={workflow.statuses as any}
        initialEpics={epics as any}
      />
    </Suspense>
  );
}
