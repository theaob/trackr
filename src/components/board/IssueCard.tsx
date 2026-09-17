"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Issue } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon } from "@/components/common/IssueIcons";
import { CheckSquare, User as UserIcon } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";


interface IssueCardProps {
  issue: Issue;
  index: number;
  onClick: () => void;
  doneStatusNames?: string[];
}

export default function IssueCard({ issue, index, onClick, doneStatusNames = ["DONE"] }: IssueCardProps) {
  const completedSubtasks =
    issue.children?.filter((c) => doneStatusNames.includes(c.status)).length || 0;
  const totalSubtasks = issue.children?.length || 0;

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`group bg-white rounded border p-3 mb-2 shadow-[0_1px_2px_rgba(9,30,66,0.25)] hover:shadow-md hover:border-jira-blue transition-all cursor-pointer select-none ${
            snapshot.isDragging
              ? "shadow-xl border-jira-blue ring-2 ring-jira-blue/20 rotate-1"
              : "border-jira-gray-300"
          }`}
        >
          {/* Epic Tag if available */}
          {issue.parent && (
            <div className="mb-1.5 flex items-center">
              <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded tracking-wide max-w-[200px] truncate">
                {issue.parent.title}
              </span>
            </div>
          )}

          {/* Title */}
          <h4 className="text-sm font-medium text-jira-navy leading-snug line-clamp-2 mb-2 group-hover:text-jira-blue transition-colors">
            {issue.title}
          </h4>

          {/* Subtask progress if any */}
          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-jira-gray-600">
              <CheckSquare className="w-3.5 h-3.5 text-jira-gray-500" />
              <span>
                {completedSubtasks}/{totalSubtasks} subtasks
              </span>
              <div className="w-12 h-1.5 bg-jira-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-jira-blue rounded-full"
                  style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Bottom Row: Key, Type, Priority, Story Points, Assignee */}
          <div className="flex items-center justify-between mt-1 pt-1">
            <div className="flex items-center gap-1.5">
              <IssueTypeBadge type={issue.type} size="xs" />
              <span className="text-[11px] font-semibold text-jira-gray-600 group-hover:underline">
                {issue.key}
              </span>
              <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5 ml-0.5" />
            </div>

            <div className="flex items-center gap-2">
              {issue.storyPoints !== null && issue.storyPoints !== undefined && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-jira-gray-200 text-jira-gray-800 min-w-[18px]">
                  {issue.storyPoints}
                </span>
              )}

              {issue.assignee ? (
                <UserAvatar
                  user={issue.assignee}
                  size="xs"
                  showTooltip
                  tooltipPrefix="Assignee"
                  className="border border-white shadow-xs"
                />
              ) : (
                <div
                  title="Unassigned"
                  className="w-5 h-5 rounded-full border border-dashed border-jira-gray-400 flex items-center justify-center text-jira-gray-500"
                >
                  <UserIcon className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
