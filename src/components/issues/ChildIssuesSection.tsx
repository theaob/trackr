"use client";

import React, { useEffect, useRef, useState } from "react";
import { Issue, IssueType, WorkflowStatus } from "@/types";
import { IssueTypeIcon, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { createIssue, updateIssue, searchProjectIssuesForEpic } from "@/lib/actions/issues";
import {
  Plus,
  Unlink,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Link as LinkIcon,
  X,
  ExternalLink,
} from "lucide-react";
import { isDoneStatus } from "@/lib/workflowDisplay";

interface ChildIssuesSectionProps {
  parentIssue: Issue;
  childIssues?: Issue[];
  canEdit: boolean;
  workflowStatuses?: WorkflowStatus[];
  onChildAdded: (newChild: Issue) => void;
  onChildRemoved: (childId: string) => void;
  onOpenChild: (childKey: string) => void;
}

export default function ChildIssuesSection({
  parentIssue,
  childIssues: children = [],
  canEdit,
  workflowStatuses = [],
  onChildAdded,
  onChildRemoved,
  onOpenChild,
}: ChildIssuesSectionProps) {
  const isEpic = parentIssue.type === "EPIC";
  const [isCreating, setIsCreating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<IssueType>(isEpic ? "STORY" : "SUBTASK");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Link existing state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doneStatusNames = React.useMemo(() => {
    const fromWorkflow = workflowStatuses.filter((s) => s.category === "DONE").map((s) => s.name);
    return fromWorkflow.length > 0 ? fromWorkflow : ["DONE"];
  }, [workflowStatuses]);

  const inProgressStatusNames = React.useMemo(() => {
    const fromWorkflow = workflowStatuses
      .filter((s) => s.category === "IN_PROGRESS")
      .map((s) => s.name);
    return fromWorkflow.length > 0 ? fromWorkflow : ["IN_PROGRESS", "IN_REVIEW"];
  }, [workflowStatuses]);

  // Calculations
  const totalCount = children.length;
  const doneCount = children.filter((c) => isDoneStatus(c.status, workflowStatuses)).length;
  const inProgressCount = children.filter(
    (c) => !isDoneStatus(c.status, workflowStatuses) && inProgressStatusNames.includes(c.status)
  ).length;
  const todoCount = Math.max(0, totalCount - doneCount - inProgressCount);

  const totalPoints = children.reduce((sum, c) => sum + (Number(c.storyPoints) || 0), 0);
  const donePoints = children
    .filter((c) => isDoneStatus(c.status, workflowStatuses))
    .reduce((sum, c) => sum + (Number(c.storyPoints) || 0), 0);

  const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const inProgressPct = totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0;
  const todoPct = totalCount > 0 ? Math.max(0, 100 - donePct - inProgressPct) : 0;

  // Search existing issues
  useEffect(() => {
    if (!isLinking) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await searchProjectIssuesForEpic(
        parentIssue.projectId,
        parentIssue.id,
        searchQuery
      );
      // Filter out any that are already in children
      const existingIds = new Set(children.map((c) => c.id));
      setSearchResults(results.filter((r) => !existingIds.has(r.id)));
      setIsSearching(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, isLinking, parentIssue.projectId, parentIssue.id, children]);

  const handleCreateChild = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setIsSubmitting(true);
    setCreateError(null);

    const res = await createIssue({
      title,
      type: newType,
      projectId: parentIssue.projectId,
      parentId: parentIssue.id,
    });

    setIsSubmitting(false);

    if (res.success && res.issue) {
      onChildAdded(res.issue as unknown as Issue);
      setNewTitle("");
      setIsCreating(false);
    } else {
      setCreateError(res.error || "Failed to create issue.");
    }
  };

  const handleLinkExisting = async (targetIssue: any) => {
    setIsSubmitting(true);
    const res = await updateIssue(targetIssue.id, {
      parentId: parentIssue.id,
    });
    setIsSubmitting(false);

    if (res.success && res.issue) {
      onChildAdded(res.issue as unknown as Issue);
      setIsLinking(false);
      setSearchQuery("");
      setSearchResults([]);
    } else {
      alert(res.error || "Failed to link issue.");
    }
  };

  const handleUnlink = async (childId: string) => {
    setUnlinkingId(childId);
    const res = await updateIssue(childId, {
      parentId: null,
    });
    setUnlinkingId(null);

    if (res.success) {
      onChildRemoved(childId);
    } else {
      alert(res.error || "Failed to unlink issue.");
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider">
            {isEpic ? "Issues in this epic" : "Subtasks"}
          </h3>
          <span className="text-xs bg-jira-gray-100 text-jira-gray-600 px-2 py-0.5 rounded-full font-semibold">
            {totalCount}
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            {isEpic && (
              <button
                type="button"
                onClick={() => {
                  setIsLinking(!isLinking);
                  setIsCreating(false);
                }}
                className={`p-1.5 text-xs rounded border transition-colors flex items-center gap-1 ${
                  isLinking
                    ? "bg-jira-blue text-white border-jira-blue"
                    : "text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 border-jira-gray-300"
                }`}
                title="Link existing issue"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="font-medium hidden sm:inline">Link issue</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsCreating(!isCreating);
                setIsLinking(false);
              }}
              className={`p-1.5 text-xs rounded border transition-colors flex items-center gap-1 ${
                isCreating
                  ? "bg-jira-blue text-white border-jira-blue"
                  : "text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 border-jira-gray-300"
              }`}
              title={isEpic ? "Add issue to epic" : "Add subtask"}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-medium hidden sm:inline">
                {isEpic ? "Add issue" : "Add subtask"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Progress Rollup (if there are children) */}
      {totalCount > 0 && (
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-jira-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-jira-navy">
                {doneCount} of {totalCount} completed ({donePct}%)
              </span>
              {totalPoints > 0 && (
                <span className="text-jira-gray-400">
                  &middot; {donePoints} of {totalPoints} story points
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {doneCount} Done
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {inProgressCount} In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-jira-gray-300"></span>
                {todoCount} To Do
              </span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="w-full h-2 bg-jira-gray-200 rounded-full overflow-hidden flex">
            {donePct > 0 && (
              <div
                style={{ width: `${donePct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`${doneCount} Done (${donePct}%)`}
              />
            )}
            {inProgressPct > 0 && (
              <div
                style={{ width: `${inProgressPct}%` }}
                className="bg-blue-500 h-full transition-all duration-300"
                title={`${inProgressCount} In Progress (${inProgressPct}%)`}
              />
            )}
            {todoPct > 0 && (
              <div
                style={{ width: `${todoPct}%` }}
                className="bg-jira-gray-300 h-full transition-all duration-300"
                title={`${todoCount} To Do (${todoPct}%)`}
              />
            )}
          </div>
        </div>
      )}

      {/* Link Existing Issue Popover/Dropdown */}
      {isLinking && (
        <div className="bg-white border border-jira-blue/40 ring-1 ring-jira-blue/20 rounded-md p-3 space-y-2 shadow-sm animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-jira-navy flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-jira-blue" />
              Link existing issue to {isEpic ? "this epic" : "this issue"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLinking(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="text-jira-gray-400 hover:text-jira-navy"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by issue or epic key or title..."
              className="w-full text-xs px-2.5 py-1.5 border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-gray-400 absolute right-2.5 top-2" />
            )}
          </div>

          {(searchQuery.trim() || searchResults.length > 0) && (
            <div className="max-h-48 overflow-y-auto border border-jira-gray-200 rounded divide-y divide-jira-gray-100">
              {searchResults.length > 0 ? (
                searchResults.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleLinkExisting(issue)}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-jira-blue/5 text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <IssueTypeIcon type={issue.type} className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold text-jira-gray-600 shrink-0">{issue.key}</span>
                      <span className="truncate text-jira-navy group-hover:text-jira-blue">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={issue.status} />
                      <Plus className="w-3.5 h-3.5 text-jira-blue opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))
              ) : !isSearching ? (
                <div className="p-3 text-xs text-jira-gray-500 text-center italic">
                  No matching issues found in this project.
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Quick Create Inline Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateChild}
          className="bg-white border border-jira-blue/40 ring-1 ring-jira-blue/20 rounded-md p-3 space-y-2.5 shadow-sm animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-jira-navy">
              {isEpic ? "Create new issue in epic" : "Create subtask"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewTitle("");
                setCreateError(null);
              }}
              className="text-jira-gray-400 hover:text-jira-navy"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2">
            {isEpic ? (
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as IssueType)}
                className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs text-jira-navy outline-none focus:border-jira-blue font-medium shrink-0"
              >
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="EPIC">Epic</option>
              </select>
            ) : (
              <span className="inline-flex items-center gap-1 bg-jira-gray-100 text-jira-gray-700 px-2 py-1 rounded text-xs font-medium shrink-0">
                <IssueTypeIcon type="SUBTASK" className="w-3 h-3" />
                Subtask
              </span>
            )}

            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 text-xs px-2.5 py-1 border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Create</span>
            </button>
          </div>

          {createError && <p className="text-[11px] text-rose-600 font-medium">{createError}</p>}
        </form>
      )}

      {/* Child Issues List / Table */}
      {totalCount > 0 ? (
        <div className="border border-jira-gray-200 rounded-md overflow-hidden divide-y divide-jira-gray-100 bg-white">
          {children.map((child) => {
            const isDone = doneStatusNames.includes(child.status);
            return (
              <div
                key={child.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-jira-gray-50/80 transition-colors group cursor-pointer"
                onClick={() => onOpenChild(child.key)}
              >
                {/* Left: Type Icon, Key, Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                  <IssueTypeIcon type={child.type} className="w-3.5 h-3.5 shrink-0" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChild(child.key);
                    }}
                    className={`text-xs font-bold text-jira-blue hover:underline shrink-0 ${
                      isDone ? "line-through text-jira-gray-400" : ""
                    }`}
                  >
                    {child.key}
                  </button>
                  <span
                    className={`text-xs text-jira-navy font-medium truncate ${
                      isDone ? "line-through text-jira-gray-400" : ""
                    }`}
                    title={child.title}
                  >
                    {child.title}
                  </span>
                </div>

                {/* Right: Points, Priority, Status, Assignee, Actions */}
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {child.storyPoints !== null && child.storyPoints !== undefined && (
                    <span className="text-[10px] font-bold bg-jira-gray-100 text-jira-gray-600 px-1.5 py-0.5 rounded">
                      {child.storyPoints}
                    </span>
                  )}

                  <PriorityIcon priority={child.priority} className="w-3.5 h-3.5" />

                  <StatusBadge status={child.status} />

                  <UserAvatar user={child.assignee} size="sm" />

                  {canEdit && (
                    <button
                      type="button"
                      disabled={unlinkingId === child.id}
                      onClick={() => handleUnlink(child.id)}
                      className="p-1 text-jira-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      title={isEpic ? "Unlink from epic" : "Unlink subtask"}
                    >
                      {unlinkingId === child.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !isCreating &&
        !isLinking && (
          <div className="p-4 bg-jira-gray-50 border border-jira-gray-200 border-dashed rounded-md text-center">
            <p className="text-xs text-jira-gray-500 italic mb-2">
              {isEpic
                ? "No issues in this epic yet. Break down this epic by adding stories, tasks, or bugs."
                : "No subtasks yet."}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-1.5 text-xs text-jira-blue font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEpic ? "Create first issue in epic" : "Create subtask"}</span>
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
