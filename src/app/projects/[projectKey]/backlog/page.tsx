import React, { Suspense } from "react";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getBacklogIssues } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import BacklogView from "@/components/backlog/BacklogView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
  searchParams?: { selectedIssue?: string; issue?: string };
}

export default async function BacklogPage({ params, searchParams }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/backlog`);

  const [issues, users, sprints, workflow] = await Promise.all([
    getBacklogIssues(project.id),
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectWorkflow(project.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-xs text-jira-gray-500">Loading backlog...</div>}>
      <BacklogView
        project={project as any}
        initialIssues={issues as any}
        users={users as any}
        initialSprints={sprints as any}
        statuses={workflow.statuses as any}
        initialSelectedIssueKey={searchParams?.selectedIssue || searchParams?.issue}
      />
    </Suspense>
  );
}
