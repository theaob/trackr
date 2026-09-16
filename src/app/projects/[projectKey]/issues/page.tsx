import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProjectByKey, getAllUsers, getProjects } from "@/lib/actions/projects";
import { getPaginatedIssues } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import IssuesListView from "@/components/issues/IssuesListView";

interface PageProps {
  params: { projectKey: string };
  searchParams?: { selectedIssue?: string; issue?: string };
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) notFound();

  const [allProjects, paginatedData, users, sprints, versions] = await Promise.all([
    getProjects(),
    getPaginatedIssues({ projectId: project.id, page: 1, pageSize: 50, sortField: "createdAt", sortOrder: "desc" }),
    getAllUsers(),
    getProjectSprints(project.id),
    getProjectVersions(project.id),
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
        initialSelectedIssueKey={searchParams?.selectedIssue || searchParams?.issue}
      />
    </Suspense>
  );
}

