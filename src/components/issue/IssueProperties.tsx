"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { IssueStatus, IssueType, PriorityLevel } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import CustomFieldRenderer from "@/components/common/CustomFieldRenderer";
import LabelsSection from "@/components/issues/LabelsSection";
import ComponentsField from "@/components/issues/ComponentsField";
import TimeTrackingField from "@/components/issues/TimeTrackingField";
import { Select, Combobox, type SelectOption } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { calendarDateKey } from "@/lib/calendarDate";
import { isOverdue } from "@/lib/dueDate";
import { allowedNextStatusNames, prettifyStatusName } from "@/lib/workflowDisplay";
import type { IssueData } from "./useIssueData";

export type PickerName = "status" | "assignee" | "priority";

const PRIORITIES: PriorityLevel[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];
const TYPES: IssueType[] = ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"];
const TYPE_NAMES: Record<IssueType, string> = { STORY: "Story", TASK: "Task", BUG: "Bug", EPIC: "Epic", SUBTASK: "Subtask" };
const PRIORITY_NAMES: Record<PriorityLevel, string> = { HIGHEST: "Highest", HIGH: "High", MEDIUM: "Medium", LOW: "Low", LOWEST: "Lowest" };

/** A property's name on the left, its value (usually a picker) on the right. */
function Property({
  label,
  hint,
  children,
  align = "center",
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={cn("grid min-h-8 grid-cols-[104px_minmax(0,1fr)] gap-2", align === "center" ? "items-center" : "items-start")}>
      <div className={cn("flex items-center gap-1 text-xs text-ink-2", align === "start" && "pt-2")}>
        <span className="truncate">{label}</span>
        {hint}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd aria-hidden="true" className="rounded border border-subtle bg-surface-sunk px-1 font-mono text-[10px] leading-4 text-muted">
      {children}
    </kbd>
  );
}

const plainInput =
  "h-8 w-full rounded-control border border-transparent bg-transparent px-2 text-[13px] text-ink transition-colors hover:bg-surface-sunk focus:border-accent focus:bg-surface disabled:cursor-not-allowed disabled:hover:bg-transparent";

export interface IssuePropertiesProps {
  data: IssueData;
  openPicker: PickerName | null;
  onOpenPickerChange: (picker: PickerName | null) => void;
}

/**
 * The issue's properties as a list. Each value is a button that opens a
 * searchable picker; A, S and P open the assignee, status and priority ones
 * from anywhere in the view, and I assigns the issue to you.
 */
export default function IssueProperties({ data, openPicker, onOpenPickerChange }: IssuePropertiesProps) {
  const { currentUser } = useCurrentUser();
  const { issue, permissions, actions, sections, statuses, transitions, users, sprints, versions, epics, isKanban, projectKey } = data;
  const canEdit = permissions.canEditIssue;
  const pickerProps = (name: PickerName) => ({
    open: openPicker === name,
    onOpenChange: (open: boolean) => onOpenPickerChange(open ? name : null),
  });

  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color;
  const statusOptions: SelectOption[] = allowedNextStatusNames(issue.status, statuses, transitions).map((name) => ({
    value: name,
    label: prettifyStatusName(name),
    icon: (
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-strong"
        style={statusColor(name) ? { backgroundColor: statusColor(name), borderColor: statusColor(name) } : undefined}
      />
    ),
  }));

  const people = [...users];
  if (issue.assignee && !people.some((u) => u.id === issue.assignee!.id)) people.push(issue.assignee);
  const assigneeOptions: SelectOption[] = [
    {
      value: "",
      label: "Unassigned",
      icon: <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-dashed border-strong" />,
    },
    ...people.map((u) => ({ value: u.id, label: u.name, keywords: u.email, icon: <UserAvatar user={u} size="xs" /> })),
  ];

  const priorityOptions: SelectOption[] = PRIORITIES.map((p) => ({
    value: p,
    label: PRIORITY_NAMES[p],
    icon: <PriorityIcon priority={p} className="h-4 w-4 shrink-0" />,
  }));
  const typeOptions: SelectOption[] = TYPES.map((t) => ({
    value: t,
    label: TYPE_NAMES[t],
    icon: <IssueTypeIcon type={t} className="h-4 w-4 shrink-0" />,
  }));

  const epicOptions: SelectOption[] = [
    { value: "", label: "None" },
    ...(issue.parent && !epics.some((e) => e.id === issue.parent!.id)
      ? [{ value: issue.parent.id, label: issue.parent.title, description: issue.parent.key, keywords: issue.parent.key }]
      : []),
    ...epics.map((e) => ({
      value: e.id,
      label: e.title,
      description: e.key,
      keywords: e.key,
      icon: <IssueTypeIcon type="EPIC" className="h-4 w-4 shrink-0" />,
    })),
  ];

  const sprintOptions: SelectOption[] = [
    { value: "", label: "Backlog" },
    ...sprints
      .filter((s) => s.status !== "COMPLETED" || s.id === issue.sprintId)
      .map((s) => ({
        value: s.id,
        label: s.name,
        description: s.status === "ACTIVE" ? "Active" : s.status === "FUTURE" ? "Planned" : "Completed",
        disabled: s.status === "COMPLETED" && s.id !== issue.sprintId,
      })),
  ];

  const versionOptions: SelectOption[] = [
    { value: "", label: "None" },
    ...(issue.version && !versions.some((v) => v.id === issue.version!.id)
      ? [{ value: issue.version.id, label: issue.version.name, description: issue.version.status }]
      : []),
    ...versions.map((v) => ({ value: v.id, label: v.name, description: v.status.charAt(0) + v.status.slice(1).toLowerCase() })),
  ];

  const doneNames = statuses.filter((s) => s.category === "DONE").map((s) => s.name);
  const overdue = isOverdue(issue.dueDate, issue.status, doneNames);
  const canAssignToMe = !!currentUser && canEdit && issue.assigneeId !== currentUser.id;

  return (
    <div className="flex flex-col gap-0.5">
      <Property label="Status" hint={canEdit ? <Kbd>S</Kbd> : undefined}>
        <Select
          variant="property"
          aria-label="Status"
          aria-keyshortcuts="S"
          options={statusOptions}
          value={issue.status}
          onChange={(v) => actions.setStatus(v as IssueStatus)}
          disabled={!canEdit}
          searchable={statusOptions.length > 7}
          {...pickerProps("status")}
        />
      </Property>

      <Property label="Assignee" hint={canEdit ? <Kbd>A</Kbd> : undefined}>
        <div className="flex flex-col items-start">
          <Combobox
            variant="property"
            aria-label="Assignee"
            aria-keyshortcuts="A"
            options={assigneeOptions}
            value={issue.assigneeId ?? ""}
            onChange={(v) => actions.setAssignee(v || null)}
            disabled={!canEdit}
            searchPlaceholder="Find a person…"
            {...pickerProps("assignee")}
          />
          {canAssignToMe && (
            <button
              type="button"
              onClick={() => actions.setAssignee(currentUser!.id)}
              aria-keyshortcuts="I"
              className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-control px-2 text-xs font-medium text-accent hover:bg-accent-soft"
            >
              Assign to me{" "}
              <span aria-hidden="true" className="text-muted">
                ·
              </span>{" "}
              <Kbd>I</Kbd>
            </button>
          )}
        </div>
      </Property>

      <Property label="Priority" hint={canEdit ? <Kbd>P</Kbd> : undefined}>
        <Select
          variant="property"
          aria-label="Priority"
          aria-keyshortcuts="P"
          options={priorityOptions}
          value={issue.priority}
          onChange={(v) => actions.setPriority(v as PriorityLevel)}
          disabled={!canEdit}
          {...pickerProps("priority")}
        />
      </Property>

      <Property label="Type">
        <Select
          variant="property"
          aria-label="Type"
          options={typeOptions}
          value={issue.type}
          onChange={(v) => actions.setType(v as IssueType)}
          disabled={!canEdit}
        />
      </Property>

      <Property label="Reporter">
        <div className="flex h-8 items-center gap-2 px-2 text-[13px] text-ink">
          <UserAvatar user={issue.reporter} size="xs" />
          <span className="truncate">{issue.reporter?.name ?? "Anonymous"}</span>
        </div>
      </Property>

      <Property label="Parent epic">
        <Combobox
          variant="property"
          aria-label="Parent epic"
          options={epicOptions}
          value={issue.parentId ?? ""}
          onChange={(v) => actions.setParent(v || null)}
          disabled={!canEdit}
          placeholder="None"
          searchPlaceholder="Find an epic…"
        />
      </Property>

      {/* Epics span sprints, and Kanban projects have none. */}
      {!isKanban && issue.type !== "EPIC" && (
        <Property label="Sprint">
          <Select
            variant="property"
            aria-label="Sprint"
            options={sprintOptions}
            value={issue.sprintId ?? ""}
            onChange={(v) => actions.setSprint(v || null)}
            disabled={!canEdit}
            searchable={sprintOptions.length > 7}
          />
        </Property>
      )}

      <Property label="Fix version">
        <div className="flex flex-col items-start">
          <Combobox
            variant="property"
            aria-label="Fix version"
            options={versionOptions}
            value={issue.versionId ?? ""}
            onChange={(v) => actions.setVersion(v || null)}
            disabled={!canEdit}
            searchPlaceholder="Find a release…"
            emptyMessage="No releases"
          />
          {versions.length === 0 && permissions.canManageVersions && (
            <Link prefetch={false} href={`/projects/${projectKey}/releases`} className="inline-flex h-6 items-center px-2 text-xs text-accent hover:underline">
              Create a release
            </Link>
          )}
        </div>
      </Property>

      <Property label="Story points">
        <input
          type="number"
          min={0}
          max={100}
          aria-label="Story points"
          placeholder="None"
          disabled={!canEdit}
          defaultValue={issue.storyPoints ?? ""}
          key={`${issue.id}-${issue.storyPoints ?? ""}`}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const points = raw === "" ? null : Math.max(0, Math.min(100, parseInt(raw, 10)));
            if (points !== issue.storyPoints && (points === null || !Number.isNaN(points))) actions.setStoryPoints(points);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className={cn(plainInput, "placeholder:text-muted")}
        />
      </Property>

      {issue.type === "EPIC" && (
        <Property label="Start date">
          <input
            type="date"
            aria-label="Start date"
            disabled={!canEdit}
            value={calendarDateKey(issue.startDate)}
            onChange={(e) => actions.setStartDate(e.target.value)}
            className={plainInput}
          />
        </Property>
      )}

      <Property label="Due date">
        <input
          type="date"
          aria-label="Due date"
          aria-describedby={overdue ? `${issue.id}-overdue` : undefined}
          disabled={!canEdit}
          value={calendarDateKey(issue.dueDate)}
          onChange={(e) => actions.setDueDate(e.target.value)}
          className={cn(plainInput, overdue && "font-medium text-danger")}
        />
        {overdue && (
          <span id={`${issue.id}-overdue`} className="sr-only">
            Overdue
          </span>
        )}
      </Property>

      <Property label="Labels" align="start">
        <div className="px-2 py-1.5">
          <LabelsSection
            issueId={issue.id}
            projectId={issue.projectId}
            labels={issue.labels}
            canEdit={canEdit}
            onLabelAdded={sections.onLabelAdded}
            onLabelRemoved={sections.onLabelRemoved}
          />
        </div>
      </Property>

      <Property label="Components" align="start">
        <div className="px-2 py-1.5">
          <ComponentsField
            issueId={issue.id}
            projectId={issue.projectId}
            components={issue.components}
            canEdit={canEdit}
            onComponentAdded={sections.onComponentAdded}
            onComponentRemoved={sections.onComponentRemoved}
          />
        </div>
      </Property>

      <div className="mt-2 border-t border-subtle pt-3">
        <TimeTrackingField
          issueId={issue.id}
          originalEstimateSeconds={issue.originalEstimateSeconds}
          remainingEstimateSeconds={issue.remainingEstimateSeconds}
          worklogs={issue.worklogs}
          canEdit={canEdit}
          canLogWork={permissions.canAddComment}
          isAdmin={permissions.canModerate}
          currentUserId={currentUser?.id}
          onEstimatesChanged={sections.onEstimatesChanged}
          onWorklogAdded={sections.onWorklogAdded}
          onWorklogRemoved={sections.onWorklogRemoved}
        />
      </div>

      {data.customFields.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 border-t border-subtle pt-3">
          {data.customFields.map((field) => (
            <Property
              key={field.id}
              label={field.name}
              align="start"
              hint={
                field.required ? (
                  <span className="text-danger" aria-label="required">
                    *
                  </span>
                ) : undefined
              }
            >
              <CustomFieldRenderer
                field={field}
                value={data.customFieldValues[field.id] || ""}
                readOnly={!canEdit}
                onChange={(value) => canEdit && actions.setCustomFieldValue(field.id, value)}
              />
              {field.description && <p className="mt-0.5 text-[11px] leading-tight text-ink-2">{field.description}</p>}
            </Property>
          ))}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-subtle pt-3 text-xs text-ink-2">
        <dt>Created</dt>
        <dd className="px-2">{format(new Date(issue.createdAt), "MMM d, yyyy, h:mm a")}</dd>
        <dt>Updated</dt>
        <dd className="px-2">{format(new Date(issue.updatedAt), "MMM d, yyyy, h:mm a")}</dd>
      </dl>
    </div>
  );
}
