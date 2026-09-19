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
  onSelectEpic?: (epicIdOrKey: string) => void;
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
  onSelectEpic,
}: KanbanColumnProps) {
  const isOverLimit = !!(wipLimit && issues.length > wipLimit);
  const targetDroppableId = droppableId || id;
  const tooltipText = wipLimit
    ? isOverLimit
      ? `Work in progress (WIP) limit exceeded: ${issues.length} of ${wipLimit} max issues`
      : `Work in progress (WIP) limit: ${issues.length} of ${wipLimit} issues`
    : `${issues.length} ${issues.length === 1 ? "issue" : "issues"}`;

  return (
    <div className="flex flex-col w-72 shrink-0 bg-jira-gray-100 rounded-lg p-2.5 max-h-full border border-jira-gray-200">
      {/* Column Header */}
      {showHeader && (
        <div className="flex items-center justify-between pb-2 mb-1 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-jira-gray-700 tracking-wider uppercase">
              {title}
            </h3>
            <div className="relative group/wip inline-flex items-center">
              <span
                title={tooltipText}
                className={`inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full cursor-help transition-colors ${
                  isOverLimit
                    ? "bg-rose-100 text-rose-700 font-bold hover:bg-rose-200"
                    : wipLimit
                    ? "bg-jira-gray-200 text-jira-gray-700 hover:bg-jira-gray-300"
                    : "bg-jira-gray-200 text-jira-gray-700 hover:bg-jira-gray-300"
                }`}
              >
                {issues.length}
                {wipLimit ? ` / ${wipLimit}` : ""}
              </span>

              {/* Styled Floating Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/wip:flex flex-col items-center z-30 whitespace-nowrap">
                <div
                  className={`text-[11px] font-medium px-2.5 py-1 rounded shadow-lg ${
                    isOverLimit
                      ? "bg-rose-900 text-rose-100 border border-rose-700"
                      : "bg-jira-navy text-white"
                  }`}
                >
                  {wipLimit ? (
                    <span>
                      {isOverLimit ? "WIP limit exceeded: " : "WIP limit: "}
                      <strong>{issues.length}</strong> / {wipLimit} max issues
                    </span>
                  ) : (
                    <span>
                      {issues.length} {issues.length === 1 ? "issue" : "issues"}
                    </span>
                  )}
                </div>
                <div
                  className={`w-2 h-2 -mt-1 rotate-45 ${
                    isOverLimit
                      ? "bg-rose-900 border-r border-b border-rose-700"
                      : "bg-jira-navy"
                  }`}
                />
              </div>
            </div>
          </div>

          {isOverLimit && (
            <span
              title={`WIP Limit Exceeded (${issues.length} / ${wipLimit} max)`}
              className="text-rose-600 cursor-help"
            >
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
                onSelectEpic={onSelectEpic}
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
