"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, ShieldAlert } from "lucide-react";
import type { CustomField, Issue, IssueType, PriorityLevel, Project, Sprint, User, Version, WorkflowStatus } from "@/types";
import { createIssue } from "@/lib/actions/issues";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectCustomFields, batchSetIssueCustomFieldValues } from "@/lib/actions/customFields";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import CustomFieldRenderer from "@/components/common/CustomFieldRenderer";
import IssueDescriptionEditor from "@/components/issues/IssueDescriptionEditor";
import SubmitShortcutHint from "@/components/common/SubmitShortcutHint";
import { useCurrentUser } from "@/context/UserContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Field";
import { Combobox, Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const NONE = "none";
const TYPES: { value: IssueType; label: string }[] = [
  { value: "STORY", label: "Story" },
  { value: "TASK", label: "Task" },
  { value: "BUG", label: "Bug" },
  { value: "EPIC", label: "Epic" },
];
const PRIORITIES: { value: PriorityLevel; label: string }[] = [
  { value: "HIGHEST", label: "Highest" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "LOWEST", label: "Lowest" },
];
const CHIP = "h-8 w-auto max-w-64 rounded-full";
const TEXT_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[13px] text-ink-2 hover:bg-surface-sunk hover:text-ink";

export interface QuickCreateIssueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  /** Every project you can see; with more than one, the dialog offers a choice. */
  allProjects?: Project[];
  users: User[];
  sprints: Sprint[];
  epics: Issue[];
  onCreated?: (issue: Issue) => void;
}

/**
 * Creating an issue: a title, then the properties most issues need as chips
 * (type, assignee, priority, sprint). The description and the rarer fields
 * are a click away, so the usual case is one line and ⌘↵. With "Create
 * another" ticked the dialog stays open for the next one.
 */
export default function QuickCreateIssue({
  open,
  onOpenChange,
  project,
  allProjects = [],
  users,
  sprints,
  epics,
  onCreated,
}: QuickCreateIssueProps) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const focusDescription = useRef(false);

  const [projectId, setProjectId] = useState(project.id);
  const selectedProject = allProjects.find((p) => p.id === projectId) ?? project;
  const permissions = useProjectPermissions(selectedProject);
  const isKanban = selectedProject.boardType === "KANBAN";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [type, setType] = useState<IssueType>("STORY");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState(NONE);
  const [sprintId, setSprintId] = useState(NONE);
  const [storyPoints, setStoryPoints] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [versionId, setVersionId] = useState(NONE);
  const [parentId, setParentId] = useState(NONE);
  const [createAnother, setCreateAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);

  const projectSprints = useMemo(
    () => (isKanban ? [] : sprints.filter((s) => (!s.projectId || s.projectId === projectId) && s.status !== "COMPLETED")),
    [isKanban, sprints, projectId]
  );
  const projectEpics = useMemo(() => epics.filter((e) => e.projectId === projectId), [epics, projectId]);
  const activeSprintId = projectSprints.find((s) => s.status === "ACTIVE")?.id ?? NONE;

  // A fresh form each time it opens, in the project you're in.
  useEffect(() => {
    if (!open) return;
    setProjectId(project.id);
    setTitle("");
    setDescription("");
    setShowDescription(false);
    setShowMore(false);
    setType("STORY");
    setPriority("MEDIUM");
    setAssigneeId(NONE);
    setStoryPoints("");
    setDueDate("");
    setStartDate("");
    setParentId(NONE);
    setError(null);
  }, [open, project.id]);

  // What depends on the project: its sprint, fields, workflow and versions.
  useEffect(() => {
    if (!open) return;
    setSprintId(activeSprintId);
    setVersionId(NONE);
    let live = true;
    getProjectCustomFields(projectId).then((fields) => {
      if (!live) return;
      setCustomFields(fields as unknown as CustomField[]);
      setCustomValues({});
      // Required fields can't hide behind "More fields".
      if ((fields as unknown as CustomField[]).some((f) => f.required)) setShowMore(true);
    });
    getProjectWorkflow(projectId).then(({ statuses }) => live && setStatuses(statuses as unknown as WorkflowStatus[]));
    getProjectVersions(projectId).then((list) => live && Array.isArray(list) && setVersions(list as unknown as Version[]));
    return () => {
      live = false;
    };
  }, [open, projectId, activeSprintId]);

  useEffect(() => {
    if (showDescription && focusDescription.current) {
      focusDescription.current = false;
      descriptionRef.current?.querySelector("textarea")?.focus();
    }
  }, [showDescription]);

  function openDescription() {
    focusDescription.current = true;
    setShowDescription(true);
  }

  async function submit() {
    if (submitting) return;
    if (!permissions.canCreateIssue) {
      setError("You don't have permission to create issues in this project.");
      return;
    }
    if (!title.trim()) {
      setError("Give the issue a title.");
      titleRef.current?.focus();
      return;
    }
    const missing = customFields.find((f) => f.required && !(customValues[f.id] ?? "").trim().replace(/^\[\]$/, ""));
    if (missing) {
      setShowMore(true);
      setError(`${missing.name} is required.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    const points = storyPoints.trim() === "" ? null : Number.parseInt(storyPoints, 10);
    const sprint = isKanban || type === "EPIC" || sprintId === NONE ? null : sprintId;
    const backlogStatus = statuses.find((s) => s.isBacklog)?.name;
    const firstStatus = statuses.find((s) => !s.isBacklog)?.name;

    const res = await createIssue({
      projectId,
      title: title.trim(),
      description,
      type,
      priority,
      storyPoints: points === null || Number.isNaN(points) ? null : points,
      dueDate: dueDate || null,
      startDate: type === "EPIC" ? startDate || null : null,
      assigneeId: assigneeId === NONE ? null : assigneeId,
      reporterId: currentUser?.id ?? null,
      sprintId: sprint,
      versionId: versionId === NONE ? null : versionId,
      parentId: type === "EPIC" || parentId === NONE ? null : parentId,
      status: sprint ? firstStatus : (backlogStatus ?? firstStatus),
    });

    if (!res.success || !res.issue) {
      setSubmitting(false);
      setError(res.error || "The issue couldn't be created.");
      return;
    }
    if (Object.keys(customValues).length > 0) await batchSetIssueCustomFieldValues(res.issue.id, customValues);
    setSubmitting(false);

    const issue = res.issue as Issue;
    window.dispatchEvent(new CustomEvent("trackr:issue-created", { detail: { issue } }));
    onCreated?.(issue);
    toast({ title: `Created ${issue.key}`, description: issue.title, tone: "success" });

    if (createAnother) {
      // Keep the properties, which the next issue usually shares.
      setTitle("");
      setDescription("");
      setShowDescription(false);
      titleRef.current?.focus();
    } else {
      onOpenChange(false);
    }
  }

  const typeOptions: SelectOption[] = TYPES.map((t) => ({ ...t, icon: <IssueTypeIcon type={t.value} className="h-4 w-4" /> }));
  const priorityOptions: SelectOption[] = PRIORITIES.map((p) => ({
    ...p,
    icon: <PriorityIcon priority={p.value} className="h-4 w-4" />,
  }));
  const assigneeOptions: SelectOption[] = [
    { value: NONE, label: "Unassigned" },
    ...users.map((u) => ({
      value: u.id,
      label: u.id === currentUser?.id ? `${u.name} (you)` : u.name,
      keywords: u.email,
      icon: <UserAvatar user={u} size="xs" />,
    })),
  ];
  const sprintOptions: SelectOption[] = [
    { value: NONE, label: "Backlog" },
    ...projectSprints.map((s) => ({ value: s.id, label: s.name, description: s.status === "ACTIVE" ? "Active" : "Planned" })),
  ];
  const showSprint = !isKanban && type !== "EPIC";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create issue"
        size="lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        footer={
          <>
            <Checkbox label="Create another" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} className="mr-auto" />
            <SubmitShortcutHint className="hidden sm:inline-flex" />
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={formId} loading={submitting} disabled={!permissions.canCreateIssue}>
              Create
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-3 pb-2"
        >
          {!permissions.canCreateIssue && (
            <p className="flex items-center gap-2 rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              You don&apos;t have permission to create issues in this project.
            </p>
          )}

          {allProjects.length > 1 && (
            <Select
              aria-label="Project"
              className={CHIP}
              value={projectId}
              onChange={setProjectId}
              options={allProjects.map((p) => ({ value: p.id, label: p.name, description: p.key }))}
            />
          )}

          <input
            ref={titleRef}
            aria-label="Title"
            aria-invalid={error && !title.trim() ? true : undefined}
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Tab goes straight into the description, opening it if need be.
              if (e.key === "Tab" && !e.shiftKey && !showDescription) {
                e.preventDefault();
                openDescription();
              }
            }}
            className="w-full rounded-control border border-transparent bg-transparent px-1 py-1 text-lg font-medium text-ink placeholder:text-muted hover:border-subtle focus:border-accent"
          />

          {showDescription ? (
            <div ref={descriptionRef}>
              <IssueDescriptionEditor
                value={description}
                onChange={setDescription}
                users={users}
                mode="always-edit"
                showSaveButtons={false}
                placeholder="Add details, steps to reproduce or acceptance criteria…"
                minRows={4}
              />
            </div>
          ) : (
            <button type="button" onClick={openDescription} className={`${TEXT_BUTTON} self-start`}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Add description
            </button>
          )}

          <div role="group" aria-label="Issue properties" className="flex flex-wrap items-center gap-2">
            <Select aria-label="Type" className={CHIP} value={type} onChange={(v) => setType(v as IssueType)} options={typeOptions} />
            <Combobox
              aria-label="Assignee"
              searchPlaceholder="Find a person…"
              className={CHIP}
              value={assigneeId}
              onChange={setAssigneeId}
              options={assigneeOptions}
            />
            <Select
              aria-label="Priority"
              className={CHIP}
              value={priority}
              onChange={(v) => setPriority(v as PriorityLevel)}
              options={priorityOptions}
            />
            {showSprint && <Select aria-label="Sprint" className={CHIP} value={sprintId} onChange={setSprintId} options={sprintOptions} />}
            {!showMore && (
              <button type="button" onClick={() => setShowMore(true)} className={TEXT_BUTTON}>
                More fields
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {showMore && (
            <div className="grid grid-cols-1 gap-3 border-t border-subtle pt-3 sm:grid-cols-2">
              <Field label="Story points">
                <Input type="number" min={0} max={100} value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} />
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              {type === "EPIC" && (
                <Field label="Start date">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
              )}
              {versions.length > 0 && (
                <Field label="Fix version">
                  <Select
                    value={versionId}
                    onChange={setVersionId}
                    options={[{ value: NONE, label: "None" }, ...versions.map((v) => ({ value: v.id, label: v.name }))]}
                  />
                </Field>
              )}
              {type !== "EPIC" && projectEpics.length > 0 && (
                <Field label="Parent epic">
                  <Combobox
                    value={parentId}
                    onChange={setParentId}
                    searchPlaceholder="Find an epic…"
                    options={[
                      { value: NONE, label: "None" },
                      ...projectEpics.map((e) => ({ value: e.id, label: e.title, description: e.key, keywords: e.key })),
                    ]}
                  />
                </Field>
              )}
              {customFields.map((field) => (
                <div key={field.id} role="group" aria-label={field.name} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-2">
                    {field.name}
                    {field.required && (
                      <span className="ml-0.5 text-danger" aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  <CustomFieldRenderer
                    field={field}
                    value={customValues[field.id] ?? ""}
                    onChange={(value) => setCustomValues((prev) => ({ ...prev, [field.id]: value }))}
                  />
                  {field.description && <p className="text-xs text-muted">{field.description}</p>}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
