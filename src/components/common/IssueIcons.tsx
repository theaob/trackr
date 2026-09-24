import React from "react";
import { IssueType, PriorityLevel, IssueStatus } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { useStatusColor } from "@/context/StatusColorsContext";
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
    bg: "bg-success-soft",
    text: "text-success",
    border: "border-success/30",
  },
  BUG: {
    label: "Bug",
    bg: "bg-danger-soft",
    text: "text-danger",
    border: "border-danger/30",
  },
  TASK: {
    label: "Task",
    bg: "bg-accent-soft",
    text: "text-accent",
    border: "border-accent/30",
  },
  EPIC: {
    label: "Epic",
    bg: "bg-epic-soft",
    text: "text-epic",
    border: "border-epic/30",
  },
  SUBTASK: {
    label: "Subtask",
    bg: "bg-accent-soft",
    text: "text-accent",
    border: "border-accent/30",
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
            role="img"
            aria-label="Epic"
            className="inline-flex items-center justify-center p-0.5 rounded bg-epic-soft text-epic shrink-0"
          >
            <Layers className={className} />
          </span>
        );
      case "STORY":
        return (
          <span
            role="img"
            aria-label="Story"
            className="inline-flex items-center justify-center p-0.5 rounded bg-success-soft text-success shrink-0"
          >
            <Bookmark className={className} />
          </span>
        );
      case "BUG":
        return (
          <span
            role="img"
            aria-label="Bug"
            className="inline-flex items-center justify-center p-0.5 rounded bg-danger-soft text-danger shrink-0"
          >
            <CircleAlert className={className} />
          </span>
        );
      case "SUBTASK":
        return (
          <span
            role="img"
            aria-label="Subtask"
            className="inline-flex items-center justify-center p-0.5 rounded bg-accent-soft text-accent shrink-0"
          >
            <GitCommit className={className} />
          </span>
        );
      case "TASK":
      default:
        return (
          <span
            role="img"
            aria-label="Task"
            className="inline-flex items-center justify-center p-0.5 rounded bg-accent-soft text-accent shrink-0"
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
      {/* The word is right beside it, so the icon's own name would only repeat it. */}
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
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
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : `Type: ${config.label}`}
      className={`inline-flex items-center ${showLabel ? "gap-1" : ""} font-semibold rounded ${padding} ${config.bg} ${config.text} border ${config.border} shrink-0 select-none shadow-2xs ${className}`}
    >
      <span aria-hidden="true" className="inline-flex">
        <IssueTypeIcon type={type} className={iconSize} />
      </span>
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
        <span role="img" aria-label="Highest priority" className="text-danger inline-flex items-center">
          <ChevronsUp className={className} />
        </span>
      );
    case "HIGH":
      return (
        <span role="img" aria-label="High priority" className="text-warning inline-flex items-center">
          <ChevronUp className={className} />
        </span>
      );
    case "MEDIUM":
      return (
        <span role="img" aria-label="Medium priority" className="text-warning inline-flex items-center">
          <Equal className={className} />
        </span>
      );
    case "LOW":
      return (
        <span role="img" aria-label="Low priority" className="text-accent inline-flex items-center">
          <ChevronDown className={className} />
        </span>
      );
    case "LOWEST":
    default:
      return (
        <span role="img" aria-label="Lowest priority" className="text-muted inline-flex items-center">
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
  // The project's workflow color, so a lozenge matches the board and reports.
  const workflowColor = useStatusColor(safeStatus);
  const effectiveColor = color ?? workflowColor;
  const getBadgeStyle = () => {
    switch (safeStatus) {
      case "BACKLOG":
        return "bg-surface-sunk text-ink-2 border-subtle";
      case "TODO":
        return "bg-surface-sunk text-ink border-subtle font-semibold";
      case "IN_PROGRESS":
        return "bg-accent-soft text-accent border-accent/30 font-semibold";
      case "IN_REVIEW":
        return "bg-epic-soft text-epic border-epic/30 font-semibold";
      case "DONE":
        return "bg-success-soft text-success border-success/30 font-semibold";
      default:
        // A custom status with no known styling: generic unless a workflow
        // color was supplied, in which case inline styles below take over.
        return "bg-surface-sunk text-ink-2 border-subtle font-semibold";
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
  const customStyle = effectiveColor
    ? { backgroundColor: `${effectiveColor}1A`, color: effectiveColor, borderColor: `${effectiveColor}66` }
    : undefined;

  return (
    <span
      style={customStyle}
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border truncate ${
        customStyle ? "" : getBadgeStyle()
      } ${className}`}
    >
      <span className="truncate">{getLabel()}</span>
    </span>
  );
}
