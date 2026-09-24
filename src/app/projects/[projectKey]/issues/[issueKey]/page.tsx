import React, { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getIssueByKeyOrId, getProjectEpics } from "@/lib/actions/issues";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getProjectVersions } from "@/lib/actions/versions";
import { denyPageAccess } from "@/lib/auth/page";
import { issueHref } from "@/lib/issueUrls";
import IssueView from "@/components/issue/IssueView";

export const dynamic = "force-dynamic";

// The title and the page read the same issue; load it once per request.
const loadIssue = cache(getIssueByKeyOrId);

interface PageProps {
  params: Promise<{ projectKey: string; issueKey: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { issueKey } = await params;
  const issue = await loadIssue(decodeURIComponent(issueKey));
  return { title: issue ? `${issue.key}: ${issue.title} · Tamam` : "Issue · Tamam" };
}

/** An issue on its own page: what links, notifications and "Open as page" lead to. */
export default async function IssuePage({ params }: PageProps) {
  const { projectKey, issueKey } = await params;
  const requested = decodeURIComponent(issueKey);
  const issue = await loadIssue(requested);
  if (!issue) return denyPageAccess(issueHref(projectKey, requested));

  // One address per issue: the right project, the key in capitals, never the id.
  if (issue.project.key !== decodeURIComponent(projectKey) || issue.key !== requested) {
    redirect(issueHref(issue.project.key, issue.key));
  }

  const project = await getProjectByKey(issue.project.key);
  if (!project) return denyPageAccess(issueHref(issue.project.key, issue.key));

  const [users, sprints, versions, epics] = await Promise.all([
    getProjectUsers(project.id),
    getProjectSprints(project.id),
    getProjectVersions(project.id),
    getProjectEpics(project.id),
  ]);

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-8">
        <IssueView
          issue={issue as any}
          variant="page"
          project={project as any}
          users={users as any}
          sprints={sprints as any}
          versions={versions as any}
          epics={epics as any}
        />
      </div>
    </div>
  );
}
