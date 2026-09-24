"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";
import { PriorityIcon } from "@/components/common/IssueIcons";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import type { PriorityLevel } from "@/types";
import type { IssueData } from "./useIssueData";
import type { PickerName } from "./IssueProperties";

const PRIORITY_NAMES: Record<string, string> = { HIGHEST: "Highest", HIGH: "High", MEDIUM: "Medium", LOW: "Low", LOWEST: "Lowest" };
const chip =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-subtle bg-surface px-3 text-[13px] text-ink active:bg-surface-sunk";

/**
 * On a phone, an issue's main properties as one row of chips. A chip opens
 * the full list with that property's picker; "All properties" opens the list.
 */
export default function PropertyChips({ data, onOpen }: { data: IssueData; onOpen: (picker?: PickerName) => void }) {
  const { issue, statuses, sprints } = data;
  const color = statuses.find((s) => s.name === issue.status)?.color;
  const sprint = sprints.find((s) => s.id === issue.sprintId);
  return (
    <div role="group" aria-label="Main properties" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
      <button type="button" className={chip} onClick={() => onOpen("status")} aria-label={`Status: ${prettifyStatusName(issue.status)}`}>
        <StatusLozenge label={prettifyStatusName(issue.status)} color={color} />
      </button>
      <button
        type="button"
        className={chip}
        onClick={() => onOpen("assignee")}
        aria-label={`Assignee: ${issue.assignee?.name ?? "Unassigned"}`}
      >
        {issue.assignee ? <UserAvatar user={issue.assignee} size="xs" /> : null}
        {issue.assignee?.name ?? "Unassigned"}
      </button>
      <button type="button" className={chip} onClick={() => onOpen("priority")} aria-label={`Priority: ${PRIORITY_NAMES[issue.priority]}`}>
        <PriorityIcon priority={issue.priority as PriorityLevel} className="h-4 w-4" />
        {PRIORITY_NAMES[issue.priority]}
      </button>
      {issue.storyPoints != null && (
        <button type="button" className={chip} onClick={() => onOpen()}>
          {issue.storyPoints} pts
        </button>
      )}
      {sprint && (
        <button type="button" className={chip} onClick={() => onOpen()}>
          <span className="max-w-40 truncate">{sprint.name}</span>
        </button>
      )}
      <button type="button" className={chip} onClick={() => onOpen()}>
        All properties
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </button>
    </div>
  );
}
