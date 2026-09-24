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
  Link as LinkIcon,
  X,
} from "lucide-react";
import { isDoneStatus } from "@/lib/workflowDisplay";
import SectionHeader, { SectionAction } from "./SectionHeader";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Popover";

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
  const { toast } = useToast();
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trackr:issue-created", { detail: { issue: res.issue } })
        );
      }
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
      toast({ title: res.error || "The issue couldn't be linked.", tone: "danger" });
    }
  };

  const handleUnlink = async (childId: string) => {
    const targetChild = children.find((c) => c.id === childId);
    onChildRemoved(childId);

    const res = await updateIssue(childId, {
      parentId: null,
    });

    if (!res.success) {
      if (targetChild) onChildAdded(targetChild);
      toast({ title: res.error || "The issue couldn't be unlinked.", tone: "danger" });
    }
  };

  if (totalCount === 0 && !canEdit) return null;

  return (
    <div className="space-y-3 min-w-0">
      <SectionHeader title={isEpic ? "Issues in this epic" : "Subtasks"} count={totalCount}>
        {canEdit && isEpic && (
          <SectionAction
            icon={<LinkIcon aria-hidden="true" />}
            pressed={isLinking}
            onClick={() => {
              setIsLinking(!isLinking);
              setIsCreating(false);
            }}
          >
            Link issue
          </SectionAction>
        )}
        {canEdit && (
          <SectionAction
            icon={<Plus aria-hidden="true" />}
            pressed={isCreating}
            onClick={() => {
              setIsCreating(!isCreating);
              setIsLinking(false);
            }}
          >
            {isEpic ? "Add issue" : "Add subtask"}
          </SectionAction>
        )}
      </SectionHeader>

      {/* Progress Rollup (if there are children) */}
      {totalCount > 0 && (
        <div className="bg-page border border-subtle rounded-md p-3 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-semibold text-ink truncate">
                {doneCount} of {totalCount} completed ({donePct}%)
              </span>
              {totalPoints > 0 && (
                <span className="text-muted shrink-0">
                  &middot; {donePoints} of {totalPoints} story points
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-[11px] shrink-0">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                {doneCount} Done
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent"></span>
                {inProgressCount} In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-strong"></span>
                {todoCount} To Do
              </span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div
            role="img"
            aria-label={`${doneCount} done, ${inProgressCount} in progress, ${todoCount} to do`}
            className="w-full h-2 bg-subtle rounded-full overflow-hidden flex"
          >
            {donePct > 0 && (
              <div
                style={{ width: `${donePct}%` }}
                className="bg-success h-full transition-all duration-300"
              />
            )}
            {inProgressPct > 0 && (
              <div
                style={{ width: `${inProgressPct}%` }}
                className="bg-accent h-full transition-all duration-300"
              />
            )}
            {todoPct > 0 && (
              <div
                style={{ width: `${todoPct}%` }}
                className="bg-strong h-full transition-all duration-300"
              />
            )}
          </div>
        </div>
      )}

      {/* Link Existing Issue Popover/Dropdown */}
      {isLinking && (
        <div className="bg-surface border border-accent/40 ring-1 ring-accent/20 rounded-md p-3 space-y-2 shadow-sm animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-accent" />
              Link existing issue to {isEpic ? "this epic" : "this issue"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLinking(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="text-muted hover:text-ink"
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
              className="w-full text-xs px-2.5 py-1.5 border border-subtle rounded focus:border-accent"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted absolute right-2.5 top-2" />
            )}
          </div>

          {(searchQuery.trim() || searchResults.length > 0) && (
            <div className="max-h-48 overflow-y-auto border border-subtle rounded divide-y divide-subtle">
              {searchResults.length > 0 ? (
                searchResults.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleLinkExisting(issue)}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-accent/5 text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <IssueTypeIcon type={issue.type} className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold text-ink-2 shrink-0">{issue.key}</span>
                      <span className="truncate text-ink group-hover:text-accent">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={issue.status} />
                      <Plus className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))
              ) : !isSearching ? (
                <div className="p-3 text-xs text-muted text-center italic">
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
          className="bg-surface border border-accent/40 ring-1 ring-accent/20 rounded-md p-3 space-y-2.5 shadow-sm animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              {isEpic ? "Create new issue in epic" : "Create subtask"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewTitle("");
                setCreateError(null);
              }}
              className="text-muted hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2 min-w-0">
            {isEpic ? (
              <Select
                aria-label="Type"
                className="w-auto shrink-0"
                value={newType}
                onChange={(v) => setNewType(v as IssueType)}
                options={(["STORY", "TASK", "BUG", "EPIC"] as IssueType[]).map((t) => ({
                  value: t,
                  label: t.charAt(0) + t.slice(1).toLowerCase(),
                  icon: <IssueTypeIcon type={t} className="h-4 w-4" />,
                }))}
              />
            ) : (
              <span className="inline-flex items-center gap-1 bg-surface-sunk text-ink-2 px-2 py-1 rounded text-xs font-medium shrink-0">
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
              className="flex-1 min-w-[140px] text-xs px-2.5 py-1 border border-subtle rounded focus:border-accent"
            />

            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-3 py-1 rounded disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Create</span>
            </button>
          </div>

          {createError && <p className="text-[11px] text-danger font-medium">{createError}</p>}
        </form>
      )}

      {/* Child Issues List / Table */}
      {totalCount > 0 ? (
        <div className="border border-subtle rounded-md overflow-hidden divide-y divide-subtle bg-surface min-w-0">
          {children.map((child) => {
            const isDone = doneStatusNames.includes(child.status);
            return (
              <div
                key={child.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-page/80 transition-colors group cursor-pointer min-w-0"
                onClick={() => onOpenChild(child.key)}
              >
                {/* Left: Type Icon, Key, Title */}
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <IssueTypeIcon type={child.type} className="w-3.5 h-3.5 shrink-0" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChild(child.key);
                    }}
                    className={`text-xs font-bold text-accent hover:underline shrink-0 ${
                      isDone ? "line-through text-muted" : ""
                    }`}
                  >
                    {child.key}
                  </button>
                  <Tooltip content={child.title}>
                    <span
                      className={`text-xs text-ink font-medium truncate ${
                        isDone ? "line-through text-muted" : ""
                      }`}
                    >
                      {child.title}
                    </span>
                  </Tooltip>
                </div>

                {/* Right: Status, Priority, Points, Assignee, Actions */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-20 sm:w-24 flex items-center justify-center shrink-0">
                    <StatusBadge status={child.status} className="w-full text-center text-[10px]" />
                  </div>

                  <div className="w-5 flex items-center justify-center shrink-0">
                    <PriorityIcon priority={child.priority} className="w-3.5 h-3.5" />
                  </div>

                  <div className="w-6 flex items-center justify-center shrink-0">
                    {child.storyPoints !== null && child.storyPoints !== undefined ? (
                      <span className="w-5 h-4 rounded-full bg-surface-sunk text-ink-2 text-[10px] font-bold flex items-center justify-center">
                        {child.storyPoints}
                      </span>
                    ) : (
                      <span className="w-5 h-4 rounded-full text-muted text-[10px] font-medium flex items-center justify-center select-none">
                        -
                      </span>
                    )}
                  </div>

                  <div className="w-6 flex items-center justify-center shrink-0">
                    {child.assignee ? (
                      <UserAvatar user={child.assignee} size="sm" showTooltip tooltipPrefix="Assignee" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-dashed border-subtle" />
                    )}
                  </div>

                  {canEdit && (
                    <div className="w-6 flex items-center justify-center shrink-0">
                      <Tooltip content={isEpic ? "Remove from epic" : "Unlink subtask"}>
                        <button
                          type="button"
                          disabled={unlinkingId === child.id}
                          onClick={() => handleUnlink(child.id)}
                          className="p-1 text-muted hover:text-danger rounded hover:bg-danger-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                          aria-label={`${isEpic ? "Remove from epic" : "Unlink subtask"}: ${child.key}`}
                        >
                          {unlinkingId === child.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Unlink className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
