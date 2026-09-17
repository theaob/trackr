"use client";

import React from "react";
import { User, IssueType, PriorityLevel } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { X, Layers } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";

export type SwimlaneGroupBy = "NONE" | "ASSIGNEE" | "EPIC" | "PRIORITY";

interface BoardFiltersProps {
  users: User[];
  selectedAssigneeIds: string[];
  onToggleAssignee: (userId: string) => void;
  selectedType: IssueType | "ALL";
  onSelectType: (type: IssueType | "ALL") => void;
  selectedPriority: PriorityLevel | "ALL";
  onSelectPriority: (priority: PriorityLevel | "ALL") => void;
  onlyMyIssues: boolean;
  onToggleOnlyMyIssues: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  groupBy: SwimlaneGroupBy;
  onSelectGroupBy: (groupBy: SwimlaneGroupBy) => void;
}

export default function BoardFilters({
  users,
  selectedAssigneeIds,
  onToggleAssignee,
  selectedType,
  onSelectType,
  selectedPriority,
  onSelectPriority,
  onlyMyIssues,
  onToggleOnlyMyIssues,
  onClearFilters,
  hasActiveFilters,
  groupBy,
  onSelectGroupBy,
}: BoardFiltersProps) {
  const { currentUser } = useCurrentUser();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-jira-gray-200">
      <div className="flex flex-wrap items-center gap-3">
        {/* "Only My Issues" Button - meaningless without a signed-in user. */}
        {currentUser && (
          <button
            onClick={onToggleOnlyMyIssues}
            className={`px-3 py-1 text-xs font-semibold rounded-md border transition-all ${
              onlyMyIssues
                ? "bg-jira-blue text-white border-jira-blue shadow-xs"
                : "bg-white text-jira-gray-800 border-jira-gray-300 hover:bg-jira-gray-100"
            }`}
          >
            Only my issues
          </button>
        )}

        {/* Member Avatar Selectors */}
        <div className="flex items-center -space-x-1.5 overflow-hidden pl-1">
          {users.map((user) => {
            const isSelected = selectedAssigneeIds.includes(user.id);
            return (
              <button
                key={user.id}
                onClick={() => onToggleAssignee(user.id)}
                title={`${user.name} (${user.role})`}
                className={`relative rounded-full transition-transform hover:scale-110 hover:z-10 focus:outline-none ${
                  isSelected
                    ? "ring-2 ring-jira-blue ring-offset-1 z-10 scale-105"
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                <UserAvatar
                  user={user}
                  size="md"
                  className="border-2 border-white"
                />
              </button>
            );
          })}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedType}
            onChange={(e) => onSelectType(e.target.value as IssueType | "ALL")}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">All Types</option>
            <option value="STORY">Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="EPIC">Epic</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedPriority}
            onChange={(e) => onSelectPriority(e.target.value as PriorityLevel | "ALL")}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGHEST">Highest</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="LOWEST">Lowest</option>
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-jira-blue hover:text-jira-blue-hover font-medium flex items-center gap-1 ml-2 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Group By / Swimlanes Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-jira-gray-700 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-jira-gray-500" />
          <span>Group by:</span>
        </label>
        <select
          value={groupBy}
          onChange={(e) => onSelectGroupBy(e.target.value as SwimlaneGroupBy)}
          className="text-xs bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 rounded-md px-2.5 py-1 font-semibold text-jira-navy outline-none focus:border-jira-blue cursor-pointer transition-colors"
        >
          <option value="NONE">None (Default Board)</option>
          <option value="ASSIGNEE">Assignee (Kullanıcı)</option>
          <option value="EPIC">Epic</option>
          <option value="PRIORITY">Priority (Öncelik)</option>
        </select>
      </div>
    </div>
  );
}
