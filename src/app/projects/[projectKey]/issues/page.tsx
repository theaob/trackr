import React, { Suspense } from "react";
import { getProjectByKey, getProjectUsers, getProjects } from "@/lib/actions/projects";
import { getPaginatedIssues } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import IssuesListView from "@/components/issues/IssuesListView";
import { denyPageAccess } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectKey: string };
  searchParams?: { selectedIssue?: string; issue?: string };
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) return denyPageAccess(`/projects/${params.projectKey}/issues`);

  const [allProjects, paginatedData, users, sprints, versions, workflow] = await Promise.all([
    getProjects(),
    getPaginatedIssues({ projectId: project.id, page: 1, pageSize: 50, sortField: "createdAt", sortOrder: "desc" }),
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectVersions(project.id),
    getProjectWorkflow(project.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-xs text-jira-gray-500">Loading issues...</div>}>
      <IssuesListView
        project={project as any}
        allProjects={allProjects as any}
        initialIssues={paginatedData.issues as any}
        initialTotalCount={paginatedData.totalCount}
        initialPage={paginatedData.page}
        initialPageSize={paginatedData.pageSize}
        initialTotalPages={paginatedData.totalPages}
        users={users as any}
        sprints={sprints as any}
        versions={versions as any}
        statuses={workflow.statuses as any}
        initialSelectedIssueKey={searchParams?.selectedIssue || searchParams?.issue}
      />
    </Suspense>
  );
}
