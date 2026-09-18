"use client";

import React from "react";
import { Project } from "@/types";
import RoadmapTimeline, { RoadmapEpic } from "./RoadmapTimeline";

interface RoadmapViewProps {
  project: Project;
  epics: RoadmapEpic[];
}

export default function RoadmapView({ project, epics }: RoadmapViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-jira-navy">Roadmap</h1>
        <p className="text-xs text-jira-gray-500 mt-0.5">{project.name}</p>
      </div>

      <div className="bg-white border border-jira-gray-200 rounded-lg p-5 shadow-xs">
        <p className="text-[11px] text-jira-gray-500 mb-4">
          Each epic&rsquo;s start and due date, with progress filled in from its issues.
          Set both dates on an epic to place it on the timeline.
        </p>
        <RoadmapTimeline epics={epics} />
      </div>
    </div>
  );
}
