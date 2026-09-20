import React from "react";
import { IssueType, PriorityLevel, IssueStatus } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import {
  Bookmark,
  CheckSquare,
  CircleAlert,
  Layers,
  ChevronDown,
  ChevronsDown,
  ChevronUp,
  ChevronsUp,
  Equal,
  GitCommit,
} from "lucide-react";

export const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  { label: string; bg: string; text: string; border: string }
> = {
  STORY: {
    label: "Story",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  BUG: {
    label: "Bug",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  TASK: {
    label: "Task",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  EPIC: {
    label: "Epic",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  SUBTASK: {
    label: "Subtask",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
};

export function IssueTypeIcon({
  type,
  className = "w-4 h-4",
  showLabel = false,
}: {
  type: IssueType;
  className?: string;
  showLabel?: boolean;
}) {
  const icon = (() => {
    switch (type) {
      case "EPIC":
        return (
          <span
            title="Epic"
            className="inline-flex items-center justify-center p-0.5 rounded bg-purple-100 text-purple-700 shrink-0"
          >
            <Layers className={className} />
          </span>
        );
      case "STORY":
        return (
          <span
            title="Story"
            className="inline-flex items-center justify-center p-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0"
          >
            <Bookmark className={className} />
          </span>
        );
      case "BUG":
        return (
          <span
            title="Bug"
            className="inline-flex items-center justify-center p-0.5 rounded bg-rose-100 text-rose-600 shrink-0"
          >
            <CircleAlert className={className} />
          </span>
        );
      case "SUBTASK":
        return (
          <span
            title="Subtask"
            className="inline-flex items-center justify-center p-0.5 rounded bg-sky-100 text-sky-600 shrink-0"
          >
            <GitCommit className={className} />
          </span>
        );
      case "TASK":
      default:
        return (
          <span
            title="Task"
            className="inline-flex items-center justify-center p-0.5 rounded bg-blue-100 text-blue-600 shrink-0"
          >
            <CheckSquare className={className} />
          </span>
        );
    }
  })();

  if (!showLabel) return icon;

  const config = ISSUE_TYPE_CONFIG[type] || ISSUE_TYPE_CONFIG.TASK;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {icon}
      <span>{config.label}</span>
    </span>
  );
}

export function IssueTypeBadge({
  type,
  size = "xs",
  className = "",
  showLabel = false,
}: {
  type: IssueType;
  size?: "xs" | "sm" | "md";
  className?: string;
  /**
   * The type name is spelled out on the issue detail only. Everywhere else the
   * coloured icon carries it, so lists stay dense and their columns line up.
   */
  showLabel?: boolean;
}) {
  const config = ISSUE_TYPE_CONFIG[type] || ISSUE_TYPE_CONFIG.TASK;
  const iconSize = size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const labelledPadding =
    size === "xs"
      ? "px-1.5 py-0.5 text-[10px]"
      : size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : "px-2.5 py-1 text-xs";
  // Square padding when there is no text to sit beside the icon.
  const iconOnlyPadding = size === "xs" ? "p-1" : size === "sm" ? "p-1.5" : "p-2";
  const padding = showLabel ? labelledPadding : iconOnlyPadding;

  return (
    <span
      title={`Issue Type: ${config.label}`}
      aria-label={showLabel ? undefined : `Issue Type: ${config.label}`}
      className={`inline-flex items-center ${showLabel ? "gap-1" : ""} font-semibold rounded ${padding} ${config.bg} ${config.text} border ${config.border} shrink-0 select-none shadow-2xs ${className}`}
    >
      <IssueTypeIcon type={type} className={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}


export function PriorityIcon({
  priority,
  className = "w-4 h-4",
}: {
  priority: PriorityLevel;
  className?: string;
}) {
  switch (priority) {
    case "HIGHEST":
      return (
        <span title="Highest Priority" className="text-red-600 inline-flex items-center">
          <ChevronsUp className={className} />
        </span>
      );
    case "HIGH":
      return (
        <span title="High Priority" className="text-orange-500 inline-flex items-center">
          <ChevronUp className={className} />
        </span>
      );
    case "MEDIUM":
      return (
        <span title="Medium Priority" className="text-amber-500 inline-flex items-center">
          <Equal className={className} />
        </span>
      );
    case "LOW":
      return (
        <span title="Low Priority" className="text-blue-500 inline-flex items-center">
          <ChevronDown className={className} />
        </span>
      );
    case "LOWEST":
    default:
      return (
        <span title="Lowest Priority" className="text-slate-400 inline-flex items-center">
          <ChevronsDown className={className} />
        </span>
      );
  }
}

export function StatusBadge({
  status,
  color,
  className = "",
}: {
  status?: IssueStatus | null;
  color?: string;
  className?: string;
}) {
  const safeStatus = status || "";
  const getBadgeStyle = () => {
    switch (safeStatus) {
      case "BACKLOG":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "TODO":
        return "bg-slate-100 text-slate-800 border-slate-300 font-semibold";
      case "IN_PROGRESS":
        return "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
      case "IN_REVIEW":
        return "bg-purple-50 text-purple-700 border-purple-200 font-semibold";
      case "DONE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
      default:
        // A custom status with no known styling: generic unless a workflow
        // color was supplied, in which case inline styles below take over.
        return "bg-gray-100 text-gray-700 border-gray-200 font-semibold";
    }
  };

  const getLabel = () => {
    if (!safeStatus) return "UNKNOWN";
    switch (safeStatus) {
      case "BACKLOG":
        return "BACKLOG";
      case "TODO":
        return "TO DO";
      case "IN_PROGRESS":
        return "IN PROGRESS";
      case "IN_REVIEW":
        return "IN REVIEW";
      case "DONE":
        return "DONE";
      default:
        return (prettifyStatusName(safeStatus) || safeStatus).toUpperCase();
    }
  };

  // A workflow color overrides the built-in palette (used for custom
  // statuses, and for the original five once someone recolors them).
  const customStyle = color
    ? { backgroundColor: `${color}1A`, color, borderColor: `${color}66` }
    : undefined;

  return (
    <span
      style={customStyle}
      title={getLabel()}
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border truncate ${
        customStyle ? "" : getBadgeStyle()
      } ${className}`}
    >
      <span className="truncate">{getLabel()}</span>
    </span>
  );
}
