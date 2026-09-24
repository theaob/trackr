import React, { Suspense } from "react";
import { getProjectByKey, getProjectUsers, getProjects } from "@/lib/actions/projects";
import { getPaginatedIssues } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import { getProjectLabels } from "@/lib/actions/labels";
import IssuesListView from "@/components/issues/IssuesListView";
import { denyPageAccess } from "@/lib/auth/page";
import { redirect } from "next/navigation";
import { legacyIssueRedirect } from "@/lib/issueUrls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selectedIssue?: string; issue?: string; tql?: string; mode?: string }>;
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const query = await searchParams;
  // Links from before issues had their own page open that page instead.
  const legacyIssue = legacyIssueRedirect(projectKey, query);
  if (legacyIssue) redirect(legacyIssue);
  const project = await getProjectByKey(projectKey);
  if (!project) return denyPageAccess(`/projects/${projectKey}/issues`);

  const [allProjects, paginatedData, users, sprints, versions, workflow, labels] = await Promise.all([
    getProjects(),
    getPaginatedIssues(
      query.tql
        ? { projectId: project.id, tql: query.tql, page: 1, pageSize: 50 }
        : { projectId: project.id, page: 1, pageSize: 50, sortField: "createdAt", sortOrder: "desc" }
    ),
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectVersions(project.id),
    getProjectWorkflow(project.id),
    getProjectLabels(project.id),
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
        labels={labels as any}
        initialFilterMode={query.mode === "tql" || query.tql ? "tql" : "basic"}
        initialTqlQuery={query.tql || ""}
      />
    </Suspense>
  );
}
