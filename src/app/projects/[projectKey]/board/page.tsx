import React, { Suspense } from "react";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getBoardIssues, getProjectEpics } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import KanbanBoard from "@/components/board/KanbanBoard";
import { denyPageAccess } from "@/lib/auth/page";
import { redirect } from "next/navigation";
import { legacyIssueRedirect } from "@/lib/issueUrls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selectedIssue?: string; issue?: string }>;
}

export default async function BoardPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const query = await searchParams;
  // Links from before issues had their own page open that page instead.
  const legacyIssue = legacyIssueRedirect(projectKey, query);
  if (legacyIssue) redirect(legacyIssue);
  const project = await getProjectByKey(projectKey);
  if (!project) return denyPageAccess(`/projects/${projectKey}/board`);

  const [users, sprints, workflow, epics, versions] = await Promise.all([
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectWorkflow(project.id),
    getProjectEpics(project.id),
    getProjectVersions(project.id),
  ]);

  // Kanban ignores sprints entirely: the board is every non-backlog issue,
  // in continuous flow, not scoped to whatever happens to be "active".
  const activeSprint =
    project.boardType === "KANBAN" ? undefined : sprints.find((s) => s.status === "ACTIVE");
  const issues = await getBoardIssues(project.id, activeSprint?.id);

  const boardStatuses = workflow.statuses.filter((s) => !s.isBacklog);

  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted">Loading board...</div>}>
      <KanbanBoard
        project={project as any}
        initialIssues={issues as any}
        users={users as any}
        sprints={sprints as any}
        versions={versions as any}
        statuses={boardStatuses as any}
        transitions={workflow.transitions as any}
        initialEpics={epics as any}
      />
    </Suspense>
  );
}
