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
    <div className="flex-1 space-y-5 overflow-y-auto p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Roadmap</h1>
        <p className="mt-0.5 text-xs text-muted">
          {project.name} · each epic&rsquo;s dates and progress. Open an epic to see its issues, or expand it to plot them.
        </p>
      </header>

      <RoadmapTimeline epics={epics} onSelectIssue={handleSelectIssue} />

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
