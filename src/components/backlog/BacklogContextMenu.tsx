"use client";

import { issueHref } from "@/lib/issueUrls";
import React, { useEffect, useRef, useState } from "react";
import { Issue, Sprint } from "@/types";
import { IssueTypeBadge } from "@/components/common/IssueIcons";
import {
  Play,
  Calendar,
  Layers,
  ExternalLink,
  Copy,
  Check,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowRight,
  Link2,
} from "lucide-react";

interface BacklogContextMenuProps {
  x: number;
  y: number;
  issue: Issue;
  sprints: Sprint[];
  isKanban?: boolean;
  canMove?: boolean;
  onClose: () => void;
  onMoveToSprint: (issueId: string, sprintId: string | null) => void;
  onOpenIssue: (issue: Issue) => void;
  onReorder?: (issueId: string, position: "top" | "bottom") => void;
}

export default function BacklogContextMenu({
  x,
  y,
  issue,
  sprints,
  isKanban = false,
  canMove = true,
  onClose,
  onMoveToSprint,
  onOpenIssue,
  onReorder,
}: BacklogContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  // Adjust positioning to keep menu inside viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    let newX = x;
    let newY = y;

    if (x + rect.width > window.innerWidth - margin) {
      newX = window.innerWidth - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      newY = window.innerHeight - rect.height - margin;
    }
    if (newX < margin) newX = margin;
    if (newY < margin) newY = margin;

    setAdjustedPos({ x: newX, y: newY });
  }, [x, y]);

  // Handle click outside and escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const handleCopyKey = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(issue.key);
      setCopiedKey(true);
      setTimeout(() => {
        setCopiedKey(false);
        onClose();
      }, 400);
    } catch {
      onClose();
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}${issueHref(issue.key.replace(/-\d+$/, ""), issue.key)}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => {
        setCopiedLink(false);
        onClose();
      }, 400);
    } catch {
      onClose();
    }
  };

  const activeSprints = sprints.filter((s) => s.status === "ACTIVE");
  const futureSprints = sprints.filter((s) => s.status === "FUTURE");
  const isInBacklog = !issue.sprintId;

  return (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
      }}
      className="fixed z-50 w-72 bg-white rounded-lg shadow-2xl border border-jira-gray-200 py-1.5 text-xs text-jira-navy select-none animate-in fade-in zoom-in-95 duration-100 divide-y divide-jira-gray-100"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header with Issue Info */}
      <div className="px-3 py-2 bg-jira-gray-50/80">
        <div className="flex items-center gap-1.5 mb-1">
          <IssueTypeBadge type={issue.type} size="xs" />
          <span className="font-bold text-jira-navy tracking-tight">{issue.key}</span>
        </div>
        <p className="text-[11px] text-jira-gray-600 truncate font-medium">
          {issue.title}
        </p>
      </div>

      {/* Reorder Group */}
      {canMove && onReorder && (
        <div className="py-1">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-jira-gray-400">
            Reorder
          </div>
          <button
            onClick={() => {
              onReorder(issue.id, "top");
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-jira-blue-light/50 hover:text-jira-blue transition-colors"
          >
            <ArrowUpToLine className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
            <span>{isInBacklog ? "Top of Backlog" : "Top of Sprint"}</span>
          </button>
          <button
            onClick={() => {
              onReorder(issue.id, "bottom");
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-jira-blue-light/50 hover:text-jira-blue transition-colors"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
            <span>{isInBacklog ? "Bottom of Backlog" : "Bottom of Sprint"}</span>
          </button>
        </div>
      )}

      {/* Sprints Group (Scrum only) */}
      {!isKanban && (
        issue.type === "EPIC" ? (
          <div className="px-3 py-2 text-[11px] text-jira-gray-500 italic">
            Epics cannot be assigned to a sprint
          </div>
        ) : canMove ? (
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-jira-gray-400">
              Move to Sprint
            </div>

            {activeSprints.length === 0 && futureSprints.length === 0 ? (
              <div className="px-3 py-1.5 text-jira-gray-400 italic text-[11px]">
                No active or planned sprints
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-jira-gray-50">
                {/* Active Sprints First */}
                {activeSprints.map((sprint) => {
                  const isCurrent = issue.sprintId === sprint.id;
                  return (
                    <button
                      key={sprint.id}
                      disabled={isCurrent}
                      onClick={() => {
                        onMoveToSprint(issue.id, sprint.id);
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? "bg-emerald-50/50 text-emerald-900 cursor-default opacity-80"
                          : "hover:bg-jira-blue-light/50 hover:text-jira-blue"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Play className="w-3.5 h-3.5 text-emerald-600 shrink-0 fill-emerald-600/20" />
                        <span className="truncate font-semibold text-jira-navy">
                          {sprint.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Future / Planned Sprints */}
                {futureSprints.map((sprint) => {
                  const isCurrent = issue.sprintId === sprint.id;
                  return (
                    <button
                      key={sprint.id}
                      disabled={isCurrent}
                      onClick={() => {
                        onMoveToSprint(issue.id, sprint.id);
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? "bg-blue-50/50 text-blue-900 cursor-default opacity-80"
                          : "hover:bg-jira-blue-light/50 hover:text-jira-blue"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
                        <span className="truncate font-medium text-jira-navy">
                          {sprint.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-jira-gray-200 text-jira-gray-700">
                          Planned
                        </span>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-jira-blue shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Move to Backlog Option */}
            {!isInBacklog && (
              <button
                onClick={() => {
                  onMoveToSprint(issue.id, null);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-amber-50 hover:text-amber-900 transition-colors mt-0.5"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-semibold text-jira-navy">Send to Backlog</span>
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 bg-amber-50/50 text-[11px] text-amber-900 font-medium">
            Viewer mode (reorder & move disabled)
          </div>
        )
      )}

      {/* Quick Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onOpenIssue(issue);
            onClose();
          }}
          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-jira-gray-100 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
          <span>Open Issue Details</span>
        </button>

        <button
          onClick={handleCopyKey}
          className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-jira-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            {copiedKey ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
            )}
            <span>{copiedKey ? "Key Copied!" : "Copy Issue Key"}</span>
          </div>
          <span className="text-[10px] text-jira-gray-400">{issue.key}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-jira-gray-100 transition-colors"
        >
          {copiedLink ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <Link2 className="w-3.5 h-3.5 text-jira-gray-500 shrink-0" />
          )}
          <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
        </button>
      </div>
    </div>
  );
}
