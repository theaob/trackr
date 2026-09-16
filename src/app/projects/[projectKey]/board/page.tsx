import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProjectByKey, getAllUsers } from "@/lib/actions/projects";
import { getBoardIssues } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import KanbanBoard from "@/components/board/KanbanBoard";

interface PageProps {
  params: { projectKey: string };
  searchParams?: { selectedIssue?: string; issue?: string };
}

export default async function BoardPage({ params, searchParams }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) notFound();

  const [users, sprints] = await Promise.all([
    getAllUsers(),
    getProjectSprints(project.id),
  ]);

  const activeSprint = sprints.find((s) => s.status === "ACTIVE");
  const issues = await getBoardIssues(project.id, activeSprint?.id);

  return (
    <Suspense fallback={<div className="p-6 text-xs text-jira-gray-500">Loading board...</div>}>
      <KanbanBoard
        project={project as any}
        initialIssues={issues as any}
        users={users as any}
        sprints={sprints as any}
        initialSelectedIssueKey={searchParams?.selectedIssue || searchParams?.issue}
      />
    </Suspense>
  );
}
