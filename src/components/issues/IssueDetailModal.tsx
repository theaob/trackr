"use client";

import React, { useState, useEffect } from "react";
import { Issue, IssueStatus, IssueType, PriorityLevel, User, Sprint, Version, CustomField, IssueLink, WorkflowStatus, WorkflowTransition } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import IssueLinksSection from "@/components/issues/IssueLinksSection";

import { useCurrentUser } from "@/context/UserContext";
import { updateIssue, deleteIssue, getIssueByKeyOrId } from "@/lib/actions/issues";
import { addComment, deleteComment } from "@/lib/actions/comments";
import {
  getProjectCustomFields,
  getIssueCustomFieldValues,
  setIssueCustomFieldValue,
} from "@/lib/actions/customFields";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import { allowedNextStatusNames, prettifyStatusName } from "@/lib/workflowDisplay";
import CustomFieldRenderer from "@/components/common/CustomFieldRenderer";
import MentionInput from "@/components/common/MentionInput";
import MentionText from "@/components/common/MentionText";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import {
  X,
  Trash2,
  Send,
  Plus,
  CheckCircle2,
  Circle,
  MessageSquare,
  History,
  Calendar,
  ExternalLink,
  ChevronDown,
  Tag,
  Sliders,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface IssueDetailModalProps {
  issue: Issue | null;
  users: User[];
  allIssues: Issue[];
  sprints?: Sprint[];
  versions?: Version[];
  onClose: () => void;
  onIssueUpdated: (updated: Issue) => void;
  onIssueDeleted: (issueId: string) => void;
}

export default function IssueDetailModal({
  issue,
  users,
  allIssues,
  sprints = [],
  versions = [],
  onClose,
  onIssueUpdated,
  onIssueDeleted,
}: IssueDetailModalProps) {
  const { currentUser } = useCurrentUser();
  const [currentIssue, setCurrentIssue] = useState<Issue | null>(issue);
  const permissions = useProjectPermissions(
    currentIssue?.project ||
      (currentIssue?.projectId
        ? ({ id: currentIssue.projectId, key: currentIssue.key.split("-")[0] } as any)
        : null)
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(issue?.title || "");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState(issue?.description || "");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Workflow State (statuses + the transition graph, for the status dropdown)
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);

  useEffect(() => {
    setCurrentIssue(issue);
    setTitle(issue?.title || "");
    setDescription(issue?.description || "");

    if (issue?.id && (!issue.comments || !issue.activityLogs)) {
      getIssueByKeyOrId(issue.id).then((full) => {
        if (full) {
          setCurrentIssue(full as unknown as Issue);
        }
      });
    }
  }, [issue]);

  // Load custom fields & values for this issue
  useEffect(() => {
    let isMounted = true;
    if (!currentIssue?.id || !currentIssue?.projectId) return;

    Promise.all([
      getProjectCustomFields(currentIssue.projectId),
      getIssueCustomFieldValues(currentIssue.id),
    ]).then(([fields, values]) => {
      if (isMounted) {
        setCustomFields(fields as any);
        const map: Record<string, string> = {};
        values.forEach((v) => {
          map[v.customFieldId] = v.value;
        });
        setCustomFieldValues(map);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentIssue?.id, currentIssue?.projectId]);

  // Load the project's workflow, for the status dropdown's allowed moves
  useEffect(() => {
    let isMounted = true;
    if (!currentIssue?.projectId) return;

    getProjectWorkflow(currentIssue.projectId).then(({ statuses, transitions }) => {
      if (isMounted) {
        setWorkflowStatuses(statuses as unknown as WorkflowStatus[]);
        setWorkflowTransitions(transitions as unknown as WorkflowTransition[]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentIssue?.projectId]);

  const handleCustomFieldChange = async (fieldId: string, val: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: val }));
    if (!currentIssue) return;
    await setIssueCustomFieldValue(currentIssue.id, fieldId, val);
  };

  if (!currentIssue) return null;


  const epics = allIssues.filter((i) => i.type === "EPIC" && i.id !== currentIssue.id);

  // Handle Save Title
  const handleSaveTitle = async () => {
    if (!title.trim() || title === currentIssue.title) {
      setTitle(currentIssue.title);
      setIsEditingTitle(false);
      return;
    }
    const res = await updateIssue(currentIssue.id, {
      title: title.trim(),
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
    setIsEditingTitle(false);
  };

  // Handle Save Description
  const handleSaveDescription = async () => {
    const res = await updateIssue(currentIssue.id, {
      description,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
    setIsEditingDesc(false);
  };

  // Handle Type Change
  const handleTypeChange = async (newType: IssueType) => {
    const res = await updateIssue(currentIssue.id, {
      type: newType,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Status Change

  const handleStatusChange = async (newStatus: IssueStatus) => {
    const res = await updateIssue(currentIssue.id, {
      status: newStatus,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Priority Change
  const handlePriorityChange = async (newPriority: PriorityLevel) => {
    const res = await updateIssue(currentIssue.id, {
      priority: newPriority,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Assignee Change
  const handleAssigneeChange = async (newAssigneeId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      assigneeId: newAssigneeId,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Parent Epic Change
  const handleParentChange = async (parentId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      parentId: parentId || null,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Sprint Change (supports adding to sprint before it starts)
  const handleSprintChange = async (sprintId: string | null) => {
    // Prevent adding to completed sprints
    if (sprintId && sprintId !== currentIssue.sprintId) {
      const targetSprint = sprints.find((s) => s.id === sprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    const currentIsBacklog = workflowStatuses.find((s) => s.name === currentIssue.status)?.isBacklog;
    const initialStatus = workflowStatuses.find((s) => !s.isBacklog)?.name ?? currentIssue.status;
    const newStatus = sprintId && currentIsBacklog ? initialStatus : currentIssue.status;
    const res = await updateIssue(currentIssue.id, {
      sprintId: sprintId || null,
      status: newStatus,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Version Change
  const handleVersionChange = async (versionId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      versionId: versionId || null,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Story Points Change
  const handleStoryPointsChange = async (pointsStr: string) => {
    const points = pointsStr === "" ? null : parseInt(pointsStr, 10);
    const res = await updateIssue(currentIssue.id, {
      storyPoints: points,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = res.issue as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    setIsSubmittingComment(true);
    const res = await addComment(currentIssue.id, currentUser.id, newComment);
    setIsSubmittingComment(false);
    if (res.success && res.comment) {
      setNewComment("");
      const updatedComments = [res.comment, ...(currentIssue.comments || [])];
      const updatedIssue = { ...currentIssue, comments: updatedComments };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    const res = await deleteComment(commentId);
    if (res.success) {
      const updatedComments = (currentIssue.comments || []).filter((c) => c.id !== commentId);
      const updatedIssue = { ...currentIssue, comments: updatedComments };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    }
  };

  // Handle Issue Link added/removed
  const handleIssueLinked = (link: IssueLink) => {
    const updatedIssue = {
      ...currentIssue,
      linksAsSource: [...(currentIssue.linksAsSource || []), link],
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleIssueUnlinked = (linkId: string) => {
    const updatedIssue = {
      ...currentIssue,
      linksAsSource: (currentIssue.linksAsSource || []).filter((l) => l.id !== linkId),
      linksAsTarget: (currentIssue.linksAsTarget || []).filter((l) => l.id !== linkId),
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  // Handle Delete Issue
  const handleDeleteIssue = async () => {
    if (!window.confirm(`Are you sure you want to delete ${currentIssue.key}?`)) return;
    setIsDeleting(true);
    const res = await deleteIssue(currentIssue.id);
    if (res.success) {
      onIssueDeleted(currentIssue.id);
      onClose();
    }
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-jira-gray-300 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-jira-gray-200 bg-jira-gray-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <IssueTypeBadge type={currentIssue.type} size="sm" showLabel />
            <span className="text-sm font-bold text-jira-gray-700">{currentIssue.key}</span>
          </div>

          <div className="flex items-center gap-3">
            {permissions.canDeleteIssue && (
              <button
                onClick={handleDeleteIssue}
                disabled={isDeleting}
                className="p-1.5 text-jira-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Delete Issue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          {/* Left Main Content */}
          <div className="flex-1 p-6 space-y-6 md:border-r border-jira-gray-200">
            {/* Title Editing */}
            <div>
              {isEditingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        setTitle(currentIssue.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    className="w-full text-xl font-bold text-jira-navy px-2 py-1 border-2 border-jira-blue rounded outline-none"
                  />
                  <div className="text-xs text-jira-gray-500">Press Enter to save, Esc to cancel</div>
                </div>
              ) : (
                <h1
                  onClick={() => permissions.canEditIssue && setIsEditingTitle(true)}
                  className={`text-xl font-bold text-jira-navy p-1.5 -ml-1.5 rounded transition-colors ${
                    permissions.canEditIssue ? "cursor-pointer hover:bg-jira-gray-100" : ""
                  }`}
                  title={permissions.canEditIssue ? "Click to edit title" : undefined}
                >
                  {currentIssue.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
                Description
              </h3>
              {isEditingDesc ? (
                <div className="space-y-2">
                  <MentionInput
                    value={description}
                    onChange={setDescription}
                    users={users}
                    rows={5}
                    placeholder="Add details, steps, or acceptance criteria... (Type @ to mention someone)"
                    className="w-full text-sm text-jira-navy p-3 border-2 border-jira-blue rounded-md outline-none leading-relaxed"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveDescription}
                      className="px-3 py-1.5 bg-jira-blue text-white rounded text-xs font-semibold hover:bg-jira-blue-hover"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setDescription(currentIssue.description || "");
                        setIsEditingDesc(false);
                      }}
                      className="px-3 py-1.5 text-jira-gray-700 hover:bg-jira-gray-100 rounded text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => permissions.canEditIssue && setIsEditingDesc(true)}
                  className={`min-h-[80px] p-3 rounded-md border border-transparent transition-all text-sm text-jira-navy leading-relaxed ${
                    permissions.canEditIssue
                      ? "hover:bg-jira-gray-100 cursor-pointer hover:border-jira-gray-300"
                      : "bg-jira-gray-50/50"
                  }`}
                >
                  {currentIssue.description ? (
                    <MentionText text={currentIssue.description} users={users} />
                  ) : (
                    <span className="text-jira-gray-500 italic">
                      {permissions.canEditIssue
                        ? "Add a description... (Type @ to mention)"
                        : "No description provided."}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Linked Issues */}
            <div className="pt-4 border-t border-jira-gray-200">
              <IssueLinksSection
                issueId={currentIssue.id}
                linksAsSource={currentIssue.linksAsSource}
                linksAsTarget={currentIssue.linksAsTarget}
                canEdit={permissions.canEditIssue}
                onIssueLinked={handleIssueLinked}
                onIssueUnlinked={handleIssueUnlinked}
              />
            </div>

            {/* Activity & Comments Section */}
            <div className="pt-4 border-t border-jira-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                    activeTab === "comments"
                      ? "border-jira-blue text-jira-blue"
                      : "border-transparent text-jira-gray-600 hover:text-jira-navy"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Comments ({currentIssue.comments?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                    activeTab === "history"
                      ? "border-jira-blue text-jira-blue"
                      : "border-transparent text-jira-gray-600 hover:text-jira-navy"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Activity History</span>
                </button>
              </div>

              {/* Tab: Comments */}
              {activeTab === "comments" && (
                <div className="space-y-4">
                  {/* New Comment Input */}
                  {permissions.canAddComment ? (
                    <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                      <UserAvatar
                        user={currentUser}
                        size="lg"
                        className="mt-1 border"
                      />
                      <div className="flex-1">
                        <MentionInput
                          value={newComment}
                          onChange={setNewComment}
                          users={users}
                          multiline={false}
                          placeholder="Add a comment... (Type @ to mention someone)"
                          onSubmit={handleAddComment}
                          className="w-full px-3 py-2 text-sm border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                        />
                        {newComment.trim().length > 0 && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="submit"
                              disabled={isSubmittingComment}
                              className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover"
                            >
                              Save comment
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewComment("")}
                              className="px-3 py-1.5 text-jira-gray-600 hover:bg-jira-gray-100 rounded text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="p-2.5 bg-jira-gray-50 border border-jira-gray-200 rounded text-xs text-jira-gray-500 italic">
                      Stakeholders/Viewers have read-only access and cannot post comments.
                    </div>
                  )}

                  {/* Comments List */}
                  <div className="space-y-3 pt-2">
                    {currentIssue.comments?.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex gap-3 group text-sm p-2 rounded-md hover:bg-jira-gray-50"
                      >
                        <UserAvatar user={comment.author} size="md" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-jira-navy text-xs">
                                {comment.author.name}
                              </span>
                              <span className="text-[11px] text-jira-gray-500">
                                {formatDistanceToNow(new Date(comment.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-jira-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <MentionText
                            text={comment.content}
                            users={users}
                            className="mt-1 text-jira-gray-800 text-sm leading-normal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Activity History */}
              {activeTab === "history" && (
                <div className="space-y-2 text-xs">
                  {currentIssue.activityLogs && currentIssue.activityLogs.length > 0 ? (
                    currentIssue.activityLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 py-1 text-jira-gray-700">
                        <span className="font-bold text-jira-navy">{log.user?.name || "User"}</span>
                        <span>{log.action.toLowerCase().replace("_", " ")}</span>
                        {log.field && <span className="font-medium text-jira-blue">[{log.field}]</span>}
                        {log.newValue && (
                          <span>
                            to <strong className="text-jira-navy">{log.newValue}</strong>
                          </span>
                        )}
                        <span className="text-jira-gray-400 ml-auto">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-jira-gray-500 italic py-2">No activity recorded yet</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Details */}
          <div className="w-full md:w-72 p-6 bg-jira-gray-50/70 space-y-5 text-sm">
            {/* Issue Type Selector */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Issue Type
              </label>
              <div className="relative">
                <select
                  value={currentIssue.type}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handleTypeChange(e.target.value as IssueType)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-8 pr-3 py-1.5 text-xs font-semibold text-jira-navy focus:border-jira-blue outline-none shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="STORY">Story</option>
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="EPIC">Epic</option>
                  <option value="SUBTASK">Subtask</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <IssueTypeIcon type={currentIssue.type} className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={currentIssue.status}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-1.5 text-xs font-semibold text-jira-navy focus:border-jira-blue outline-none shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {allowedNextStatusNames(currentIssue.status, workflowStatuses, workflowTransitions).map(
                  (name) => (
                    <option key={name} value={name}>
                      {prettifyStatusName(name)}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-jira-gray-600 uppercase tracking-wider">
                  Assignee
                </label>
                {currentUser && currentIssue.assigneeId !== currentUser.id && permissions.canEditIssue && (
                  <button
                    onClick={() => handleAssigneeChange(currentUser.id)}
                    className="text-[11px] text-jira-blue hover:underline font-semibold"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              <select
                value={currentIssue.assigneeId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleAssigneeChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Reporter */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Reporter
              </label>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded text-xs text-jira-navy">
                <UserAvatar
                  user={currentIssue.reporter}
                  size="xs"
                  className="w-4 h-4"
                />
                <span>{currentIssue.reporter?.name || "Anonymous"}</span>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="relative">
                <select
                  value={currentIssue.priority}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-7 pr-3 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="HIGHEST">Highest</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="LOWEST">Lowest</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PriorityIcon priority={currentIssue.priority} className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Story Points */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="None"
                disabled={!permissions.canEditIssue}
                value={currentIssue.storyPoints ?? ""}
                onChange={(e) => handleStoryPointsChange(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Parent Epic */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Parent Epic
              </label>
              <select
                value={currentIssue.parentId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleParentChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">None (No Epic)</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.key}: {epic.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Sprint (can assign to sprint before it starts) */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Sprint
              </label>
              <select
                value={currentIssue.sprintId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleSprintChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Backlog (No Sprint)</option>
                {sprints
                  .filter((s) => s.status !== "COMPLETED" || s.id === currentIssue.sprintId)
                  .map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={s.status === "COMPLETED" && s.id !== currentIssue.sprintId}
                    >
                      {s.name} {s.status === "ACTIVE" ? "(Active)" : s.status === "FUTURE" ? "(Future / Planned)" : "(Completed - Closed)"}
                    </option>
                  ))}
              </select>
            </div>

            {/* Fix Version */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-jira-blue" />
                Fix Version
              </label>
              <select
                value={currentIssue.versionId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleVersionChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">None (Unassigned)</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="pt-4 border-t border-jira-gray-200 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-jira-blue" />
                  <span className="text-xs font-bold text-jira-gray-600 uppercase tracking-wider">
                    Custom Fields
                  </span>
                </div>
                <div className="space-y-3">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-jira-gray-700">
                        <span>{field.name}</span>
                        {field.required && (
                          <span className="text-[10px] text-jira-red font-semibold">
                            Required
                          </span>
                        )}
                      </div>
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.id] || ""}
                        readOnly={!permissions.canEditIssue}
                        onChange={(val) => permissions.canEditIssue && handleCustomFieldChange(field.id, val)}
                      />
                      {field.description && (
                        <p className="text-[10px] text-jira-gray-400 leading-tight">
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Timestamps */}
            <div className="pt-4 border-t border-jira-gray-200 text-[11px] text-jira-gray-500 space-y-1">
              <div>Created: {format(new Date(currentIssue.createdAt), "MMM d, yyyy, h:mm a")}</div>
              <div>Updated: {format(new Date(currentIssue.updatedAt), "MMM d, yyyy, h:mm a")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
