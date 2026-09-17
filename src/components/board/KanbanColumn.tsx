"use client";

import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Issue, IssueStatus } from "@/types";
import IssueCard from "./IssueCard";
import { AlertCircle } from "lucide-react";

interface KanbanColumnProps {
  id: IssueStatus;
  droppableId?: string;
  title: string;
  issues: Issue[];
  wipLimit?: number;
  onIssueClick: (issue: Issue) => void;
  showHeader?: boolean;
  minHeightClass?: string;
  doneStatusNames?: string[];
}

export default function KanbanColumn({
  id,
  droppableId,
  title,
  issues,
  wipLimit,
  onIssueClick,
  showHeader = true,
  minHeightClass = "min-h-[150px]",
  doneStatusNames,
}: KanbanColumnProps) {
  const isOverLimit = wipLimit && issues.length > wipLimit;
  const targetDroppableId = droppableId || id;

  return (
    <div className="flex flex-col w-72 shrink-0 bg-jira-gray-100 rounded-lg p-2.5 max-h-full border border-jira-gray-200">
      {/* Column Header */}
      {showHeader && (
        <div className="flex items-center justify-between pb-2 mb-1 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-jira-gray-700 tracking-wider uppercase">
              {title}
            </h3>
            <span
              className={`inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                isOverLimit
                  ? "bg-rose-100 text-rose-700 font-bold animate-pulse"
                  : "bg-jira-gray-200 text-jira-gray-700"
              }`}
            >
              {issues.length}
              {wipLimit ? ` / ${wipLimit}` : ""}
            </span>
          </div>

          {isOverLimit && (
            <span title="WIP Limit Exceeded!" className="text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </span>
          )}
        </div>
      )}

      {/* Droppable Issue List */}
      <Droppable droppableId={targetDroppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto px-0.5 py-1 ${minHeightClass} rounded transition-colors ${
              snapshot.isDraggingOver ? "bg-jira-blue-light/30 ring-2 ring-jira-blue/30 ring-inset" : ""
            }`}
          >
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onClick={() => onIssueClick(issue)}
                doneStatusNames={doneStatusNames}
              />
            ))}
            {provided.placeholder}

            {issues.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-28 border-2 border-dashed border-jira-gray-300 rounded-md flex flex-col items-center justify-center text-jira-gray-500 text-xs select-none">
                <span>No issues in this status</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
