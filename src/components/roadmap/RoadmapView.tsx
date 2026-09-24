"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Project, User, Sprint, Issue, Version } from "@/types";
import RoadmapTimeline, { RoadmapEpic } from "./RoadmapTimeline";
import IssuePanel from "@/components/issue/IssuePanel";
import { getIssueByKeyOrId } from "@/lib/actions/issues";

interface RoadmapViewProps {
  project: Project;
  epics: RoadmapEpic[];
  users?: User[];
  sprints?: Sprint[];
  versions?: Version[];
}

export default function RoadmapView({
  project,
  epics,
  users = [],
  sprints = [],
  versions = [],
}: RoadmapViewProps) {
  const router = useRouter();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const handleSelectIssue = async (keyOrId: string) => {
    const full = await getIssueByKeyOrId(keyOrId);
    if (full) {
      setActiveIssue(full as unknown as Issue);
    }
  };

  // The epics, in timeline order, for stepping through them in the panel.
  const epicIssues = useMemo(
    () => epics.map((e) => ({ ...e, type: "EPIC" as const, projectId: project.id })) as unknown as Issue[],
    [epics, project.id]
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-jira-navy">Roadmap</h1>
        <p className="text-xs text-jira-gray-500 mt-0.5">{project.name}</p>
      </div>

      <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs overflow-x-auto">
        <p className="text-[11px] text-jira-gray-500 mb-4">
          Each epic&rsquo;s timeline and progress rollup. Click any epic to view all its linked issues,
          or expand to see child issues directly on the timeline.
        </p>
        <RoadmapTimeline epics={epics} onSelectIssue={handleSelectIssue} />
      </div>

      <IssuePanel
        issue={activeIssue}
        issues={epicIssues}
        users={users}
        sprints={sprints}
        versions={versions}
        project={project}
        onClose={() => setActiveIssue(null)}
        onIssueUpdated={(updated) => {
          setActiveIssue((prev) => (prev?.id === updated.id ? updated : prev));
          router.refresh();
        }}
        onIssueDeleted={() => {
          setActiveIssue(null);
          router.refresh();
        }}
      />
    </div>
  );
}
