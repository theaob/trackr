"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Project, User, Sprint, Issue } from "@/types";
import RoadmapTimeline, { RoadmapEpic } from "./RoadmapTimeline";
import IssueDetailModal from "@/components/issues/IssueDetailModal";
import { getIssueByKeyOrId } from "@/lib/actions/issues";

interface RoadmapViewProps {
  project: Project;
  epics: RoadmapEpic[];
  users?: User[];
  sprints?: Sprint[];
  initialSelectedIssueKey?: string;
}

export default function RoadmapView({
  project,
  epics,
  users = [],
  sprints = [],
  initialSelectedIssueKey,
}: RoadmapViewProps) {
  const router = useRouter();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const handleSelectIssue = async (keyOrId: string) => {
    const full = await getIssueByKeyOrId(keyOrId);
    if (full) {
      setActiveIssue(full as unknown as Issue);
    }
  };

  useEffect(() => {
    if (initialSelectedIssueKey) {
      handleSelectIssue(initialSelectedIssueKey);
    }
  }, [initialSelectedIssueKey]);

  useEffect(() => {
    const handleOpenIssueEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ issueKey?: string }>;
      const targetKey = customEvent.detail?.issueKey;
      if (!targetKey) return;
      handleSelectIssue(targetKey);
    };

    window.addEventListener("jira:open-issue", handleOpenIssueEvent);
    return () => {
      window.removeEventListener("jira:open-issue", handleOpenIssueEvent);
    };
  }, []);

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

      {activeIssue && (
        <IssueDetailModal
          issue={activeIssue}
          users={users}
          allIssues={epics.map((e) => ({ ...e, type: "EPIC" as const, projectId: project.id })) as any}
          sprints={sprints}
          project={project}
          onClose={() => setActiveIssue(null)}
          onIssueUpdated={(updated) => {
            if (activeIssue?.id === updated.id) {
              setActiveIssue(updated);
            }
            router.refresh();
          }}
          onIssueDeleted={() => {
            setActiveIssue(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
