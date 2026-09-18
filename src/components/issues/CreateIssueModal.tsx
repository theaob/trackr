"use client";

import React, { useState, useEffect } from "react";
import { Project, User, Issue, IssueType, PriorityLevel, Sprint, Version, CustomField, WorkflowStatus } from "@/types";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import { createIssue } from "@/lib/actions/issues";
import { getProjectCustomFields, batchSetIssueCustomFieldValues } from "@/lib/actions/customFields";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import CustomFieldRenderer from "@/components/common/CustomFieldRenderer";
import IssueDescriptionEditor from "@/components/issues/IssueDescriptionEditor";
import { useCurrentUser } from "@/context/UserContext";
import { X, Loader2, Sliders } from "lucide-react";

interface CreateIssueModalProps {
  project: Project;
  allProjects?: Project[];
  users: User[];
  sprints: Sprint[];
  versions?: Version[];
  epics: Issue[];
  onClose: () => void;
  onIssueCreated: (newIssue: Issue) => void;
}

export default function CreateIssueModal({
  project,
  allProjects = [],
  users,
  sprints,
  versions = [],
  epics,
  onClose,
  onIssueCreated,
}: CreateIssueModalProps) {
  const { currentUser } = useCurrentUser();

  const [selectedProjectId, setSelectedProjectId] = useState(project.id);
  const [type, setType] = useState<IssueType>("STORY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [versionId, setVersionId] = useState<string>("");

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Workflow State (for the initial/backlog status new issues start in)
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);

  useEffect(() => {
    let isMounted = true;
    getProjectCustomFields(selectedProjectId).then((fields) => {
      if (isMounted) {
        setCustomFields(fields as any);
        setCustomFieldValues({});
      }
    });
    getProjectWorkflow(selectedProjectId).then(({ statuses }) => {
      if (isMounted) setWorkflowStatuses(statuses as unknown as WorkflowStatus[]);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const projectSprints = sprints.filter(
    (s) => (!s.projectId || s.projectId === selectedProjectId) && s.status !== "COMPLETED"
  );
  const projectVersions = versions.filter(
    (v) => !v.projectId || v.projectId === selectedProjectId
  );

  const [sprintId, setSprintId] = useState<string>(
    projectSprints.find((s) => s.status === "ACTIVE")?.id || ""
  );
  const [parentId, setParentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter an issue summary");
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required) {
        const val = (customFieldValues[field.id] || "").trim();
        if (!val || val === "[]") {
          setError(`Please fill in required custom field: ${field.name}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);

    const points = storyPoints.trim() === "" ? null : parseInt(storyPoints, 10);

    const backlogStatusName = workflowStatuses.find((s) => s.isBacklog)?.name;
    const initialStatusName = workflowStatuses.find((s) => !s.isBacklog)?.name;
    const status = sprintId ? initialStatusName : backlogStatusName;

    const res = await createIssue({
      projectId: selectedProjectId,
      title: title.trim(),
      description,
      type,
      priority,
      storyPoints: isNaN(points as any) ? null : points,
      dueDate: dueDate || null,
      startDate: type === "EPIC" ? startDate || null : null,
      assigneeId: assigneeId || null,
      reporterId: currentUser?.id || null,
      sprintId: sprintId || null,
      versionId: versionId || null,
      parentId: parentId || null,
      status,
    });

    if (res.success && res.issue) {
      if (Object.keys(customFieldValues).length > 0) {
        await batchSetIssueCustomFieldValues(res.issue.id, customFieldValues);
      }
      setIsSubmitting(false);
      onIssueCreated(res.issue as Issue);
      onClose();
    } else {
      setIsSubmitting(false);
      setError(res.error || "Failed to create issue");
    }
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl border border-jira-gray-300 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200">
          <h2 className="text-lg font-bold text-jira-navy">Create Issue</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium">
              {error}
            </div>
          )}

          {/* Project & Issue Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Project
              </label>
              {allProjects.length > 1 ? (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy font-medium focus:border-jira-blue outline-none"
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-jira-gray-100 border border-jira-gray-300 rounded font-medium text-jira-navy">
                  {project.name} ({project.key})
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Issue Type
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as IssueType)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-9 pr-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
                >
                  <option value="STORY">Story</option>
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="EPIC">Epic</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <IssueTypeIcon type={type} className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Summary / Title */}
          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Summary <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <IssueDescriptionEditor
              value={description}
              onChange={setDescription}
              users={users}
              mode="always-edit"
              showSaveButtons={false}
              placeholder="Add details, steps to reproduce, or acceptance criteria..."
              minRows={4}
            />
          </div>

          {/* Priority, Story Points & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-9 pr-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
                >
                  <option value="HIGHEST">Highest</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="LOWEST">Lowest</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PriorityIcon priority={priority} className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 3, 5, 8"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
              />
            </div>

            {type === "EPIC" && (
              <div>
                <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
                />
              </div>
            )}
          </div>

          {/* Assignee & Sprint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
              >
                <option value="">Automatic (Unassigned)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Sprint
              </label>
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
              >
                <option value="">Backlog (No Sprint)</option>
                {projectSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.status === "ACTIVE" ? "(Active Sprint)" : s.status === "FUTURE" ? "(Planned)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fix Version */}
          {projectVersions.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Fix Version
              </label>
              <select
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
              >
                <option value="">None (Unassigned)</option>
                {projectVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Parent Epic (if not epic) */}
          {type !== "EPIC" && epics.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                Parent Epic
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
              >
                <option value="">None</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.key}: {epic.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="pt-4 border-t border-jira-gray-200 space-y-3">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-jira-blue" />
                <span className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider">
                  Custom Fields
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-jira-gray-700">
                      {field.name} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <CustomFieldRenderer
                      field={field}
                      value={customFieldValues[field.id] || ""}
                      onChange={(val) =>
                        setCustomFieldValues((prev) => ({ ...prev, [field.id]: val }))
                      }
                    />
                    {field.description && (
                      <p className="text-[11px] text-jira-gray-500">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-jira-gray-200 flex items-center justify-end gap-3">
            <span className="text-[11px] text-jira-gray-400 hidden sm:inline mr-1">
              Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-jira-gray-100 border border-jira-gray-300 rounded text-jira-gray-600">⌘↵</kbd> to submit
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-jira-gray-700 hover:bg-jira-gray-100 rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white px-4 py-2 rounded font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
