"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Project, Version, VersionStatus, IssueType } from "@/types";
import {
  archiveVersion,
  deleteVersion,
  getVersionIssues,
  removeIssueFromVersion,
} from "@/lib/actions/versions";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import UserAvatar from "@/components/common/UserAvatar";
import CreateVersionModal from "./CreateVersionModal";
import ReleaseVersionModal from "./ReleaseVersionModal";
import ReleaseNotesModal from "./ReleaseNotesModal";
import {
  Rocket,
  Plus,
  Search,
  Calendar,
  MoreHorizontal,
  FileText,
  Edit2,
  Archive,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  Package,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface ReleasesViewProps {
  project: Project;
  initialVersions: Version[];
}

export default function ReleasesView({
  project,
  initialVersions,
}: ReleasesViewProps) {
  const permissions = useProjectPermissions(project);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [statusTab, setStatusTab] = useState<VersionStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [releasingVersion, setReleasingVersion] = useState<Version | null>(null);
  const [notesVersion, setNotesVersion] = useState<Version | null>(null);

  // Expandable issues state
  const [expandedVersionIds, setExpandedVersionIds] = useState<Set<string>>(new Set());
  const [versionIssues, setVersionIssues] = useState<Record<string, any[]>>({});
  const [loadingVersionIssues, setLoadingVersionIssues] = useState<Record<string, boolean>>({});
  const [removingIssueId, setRemovingIssueId] = useState<string | null>(null);

  const toggleExpandIssues = async (versionId: string) => {
    setExpandedVersionIds((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });

    if (!versionIssues[versionId] && !loadingVersionIssues[versionId]) {
      setLoadingVersionIssues((prev) => ({ ...prev, [versionId]: true }));
      try {
        const issues = await getVersionIssues(versionId);
        setVersionIssues((prev) => ({ ...prev, [versionId]: issues }));
      } finally {
        setLoadingVersionIssues((prev) => ({ ...prev, [versionId]: false }));
      }
    }
  };

  const handleRemoveIssue = async (versionId: string, issueId: string) => {
    setRemovingIssueId(issueId);
    try {
      const res = await removeIssueFromVersion(issueId);
      if (res.success) {
        setVersionIssues((prev) => ({
          ...prev,
          [versionId]: (prev[versionId] || []).filter((i) => i.id !== issueId),
        }));
        if (res.version) {
          handleVersionSaved(res.version as unknown as Version);
        }
      }
    } finally {
      setRemovingIssueId(null);
    }
  };

  const getTypeColor = (type: IssueType) => {
    switch (type) {
      case "BUG":
        return "bg-rose-500 text-white";
      case "TASK":
        return "bg-blue-500 text-white";
      case "STORY":
        return "bg-emerald-500 text-white";
      case "EPIC":
        return "bg-purple-600 text-white";
      default:
        return "bg-jira-gray-500 text-white";
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "DONE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-jira-gray-100 text-jira-gray-700 border-jira-gray-200";
    }
  };

  // Filtered versions
  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (statusTab !== "ALL" && v.status !== statusTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = v.name.toLowerCase().includes(q);
        const matchesDesc = v.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [versions, statusTab, searchQuery]);

  // Overall Stats
  const totalCount = versions.length;
  const unreleasedCount = versions.filter((v) => v.status === "UNRELEASED").length;
  const releasedCount = versions.filter((v) => v.status === "RELEASED").length;

  const handleVersionSaved = (saved: Version) => {
    setVersions((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...saved };
        return next;
      }
      return [saved, ...prev];
    });

    if (saved.id && (expandedVersionIds.has(saved.id) || versionIssues[saved.id])) {
      getVersionIssues(saved.id).then((freshIssues) => {
        setVersionIssues((prev) => ({ ...prev, [saved.id]: freshIssues }));
      });
    }
  };

  const handleArchiveToggle = async (v: Version) => {
    const willArchive = v.status !== "ARCHIVED";
    const res = await archiveVersion(v.id, willArchive);
    if (res.success && res.version) {
      setVersions((prev) =>
        prev.map((item) => (item.id === v.id ? (res.version as unknown as Version) : item))
      );
    }
  };

  const handleDelete = async (v: Version) => {
    if (!confirm(`Are you sure you want to delete version "${v.name}"?`)) return;
    const res = await deleteVersion(v.id);
    if (res.success) {
      setVersions((prev) => prev.filter((item) => item.id !== v.id));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Top Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-jira-gray-200 shrink-0 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-jira-blue/10 rounded text-jira-blue">
                <Rocket className="w-5 h-5 text-jira-blue" />
              </div>
              <h1 className="text-xl font-bold text-jira-navy tracking-tight">Releases</h1>
            </div>
            <p className="text-xs text-jira-gray-600">
              Manage software versions, track completion progress, and generate release notes.
            </p>
          </div>

          {permissions.canManageVersions && (
            <button
              onClick={() => {
                setEditingVersion(null);
                setIsCreateModalOpen(true);
              }}
              className="text-xs font-semibold px-3.5 py-2 rounded bg-jira-blue text-white hover:bg-jira-blue-hover transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Create Version
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-jira-gray-50 border border-jira-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-medium text-jira-gray-600">Total</span>
            <span className="text-base sm:text-lg font-bold text-jira-navy">{totalCount}</span>
          </div>
          <div className="p-2 sm:p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-medium text-amber-800">Unreleased</span>
            <span className="text-base sm:text-lg font-bold text-amber-900">{unreleasedCount}</span>
          </div>
          <div className="p-2 sm:p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-medium text-emerald-800">Released</span>
            <span className="text-base sm:text-lg font-bold text-emerald-900">{releasedCount}</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "ALL", label: "All Versions" },
              { id: "UNRELEASED", label: "Unreleased" },
              { id: "RELEASED", label: "Released" },
              { id: "ARCHIVED", label: "Archived" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  statusTab === tab.id
                    ? "bg-jira-blue text-white font-semibold shadow-xs"
                    : "bg-jira-gray-100 text-jira-gray-700 hover:bg-jira-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-gray-500" />
            <input
              type="text"
              placeholder="Search versions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
            />
          </div>
        </div>
      </div>

      {/* Versions List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
        {filteredVersions.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-jira-gray-500 gap-3">
            <Package className="w-10 h-10 text-jira-gray-400 stroke-1" />
            <h3 className="text-sm font-semibold text-jira-navy">No versions found</h3>
            <p className="text-xs text-jira-gray-500 max-w-sm text-center">
              {searchQuery || statusTab !== "ALL"
                ? "Try clearing filters to view other release versions."
                : "Organize your project deliveries and plan releases by creating your first version."}
            </p>
            {(!searchQuery && statusTab === "ALL") && (
              <button
                onClick={() => {
                  setEditingVersion(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-2 text-xs font-semibold px-3 py-1.5 rounded bg-jira-blue text-white hover:bg-jira-blue-hover"
              >
                + Create Version
              </button>
            )}
          </div>
        ) : (
          filteredVersions.map((version) => {
            const counts = version.issueCount || {
              total: 0,
              done: 0,
              inProgress: 0,
              todo: 0,
              storyPoints: 0,
              completedStoryPoints: 0,
            };

            const percentDone =
              counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
            const percentInProgress =
              counts.total > 0 ? Math.round((counts.inProgress / counts.total) * 100) : 0;
            const percentTodo =
              counts.total > 0 ? Math.round((counts.todo / counts.total) * 100) : 0;

            const isOverdue =
              version.status === "UNRELEASED" &&
              version.releaseDate &&
              new Date(version.releaseDate) < new Date();

            return (
              <div
                key={version.id}
                className="bg-white border border-jira-gray-300 hover:border-jira-blue/50 rounded-lg p-3.5 sm:p-5 shadow-xs transition-all space-y-4"
              >
                {/* Card Top: Name, Status, Dates, Actions */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-jira-navy">{version.name}</h3>

                      {version.status === "RELEASED" ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          RELEASED
                        </span>
                      ) : version.status === "ARCHIVED" ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-jira-gray-200 text-jira-gray-700">
                          ARCHIVED
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          UNRELEASED
                        </span>
                      )}

                      {isOverdue && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          OVERDUE
                        </span>
                      )}
                    </div>

                    {version.description && (
                      <p className="text-xs text-jira-gray-600 line-clamp-2 max-w-xl">
                        {version.description}
                      </p>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-4 text-xs text-jira-gray-500 pt-1">
                      {version.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Start: {format(new Date(version.startDate), "MMM d, yyyy")}
                        </span>
                      )}
                      {version.releaseDate && (
                        <span
                          className={`flex items-center gap-1 ${
                            isOverdue ? "text-rose-600 font-semibold" : ""
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Release: {format(new Date(version.releaseDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Top Right Action Buttons */}
                  <div className="flex items-center gap-2">
                    {permissions.canManageVersions && version.status === "UNRELEASED" && (
                      <button
                        onClick={() => setReleasingVersion(version)}
                        className="text-xs font-semibold px-3 py-1.5 rounded bg-jira-green text-white hover:bg-jira-green/90 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        Release
                      </button>
                    )}

                    <button
                      onClick={() => setNotesVersion(version)}
                      className="text-xs font-semibold px-3 py-1.5 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 text-jira-navy transition-colors flex items-center gap-1.5"
                      title="Generate and view release notes"
                    >
                      <FileText className="w-3.5 h-3.5 text-jira-blue" />
                      Release Notes
                    </button>

                    {permissions.canManageVersions && (
                      <>
                        <button
                          onClick={() => {
                            setEditingVersion(version);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded border border-jira-gray-200"
                          title="Edit version"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleArchiveToggle(version)}
                          className="p-1.5 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded border border-jira-gray-200"
                          title={version.status === "ARCHIVED" ? "Unarchive version" : "Archive version"}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(version)}
                          className="p-1.5 text-jira-gray-600 hover:text-jira-red hover:bg-jira-red/10 rounded border border-jira-gray-200"
                          title="Delete version"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Issue Metrics */}
                <div className="pt-2 border-t border-jira-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-jira-navy">
                      Progress: <strong>{percentDone}% Done</strong>
                    </span>
                    <div className="flex items-center gap-3 text-jira-gray-600">
                      <span>
                        <strong>{counts.done}</strong> of <strong>{counts.total}</strong> issues done
                      </span>
                      {counts.storyPoints > 0 && (
                        <span>
                          • <strong>{counts.completedStoryPoints}</strong> of{" "}
                          <strong>{counts.storyPoints}</strong> pts
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-tone progress bar */}
                  <div className="w-full h-2.5 bg-jira-gray-200 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${percentDone}%` }}
                      className="bg-jira-green transition-all duration-300"
                      title={`${counts.done} Done (${percentDone}%)`}
                    />
                    <div
                      style={{ width: `${percentInProgress}%` }}
                      className="bg-jira-blue transition-all duration-300"
                      title={`${counts.inProgress} In Progress (${percentInProgress}%)`}
                    />
                    <div
                      style={{ width: `${percentTodo}%` }}
                      className="bg-jira-gray-400 transition-all duration-300"
                      title={`${counts.todo} To Do (${percentTodo}%)`}
                    />
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-[11px] text-jira-gray-600 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-jira-green" />
                      <span>Done ({counts.done})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-jira-blue" />
                      <span>In Progress ({counts.inProgress})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-jira-gray-400" />
                      <span>To Do ({counts.todo})</span>
                    </div>
                  </div>

                  {/* Expandable Issues Section */}
                  <div className="pt-3 border-t border-jira-gray-200">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleExpandIssues(version.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-jira-navy hover:text-jira-blue transition-colors group"
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-jira-gray-400 group-hover:text-jira-blue transition-transform duration-200 ${
                            expandedVersionIds.has(version.id) ? "rotate-90 text-jira-blue" : ""
                          }`}
                        />
                        <span>Issues in this release</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-jira-gray-100 text-jira-gray-700 group-hover:bg-jira-blue/10 group-hover:text-jira-blue">
                          {counts.total}
                        </span>
                      </button>

                      {permissions.canManageVersions && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVersion(version);
                            setIsCreateModalOpen(true);
                          }}
                          className="text-xs font-medium text-jira-blue hover:text-jira-blue-hover hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Manage / Add Issues</span>
                        </button>
                      )}
                    </div>

                    {expandedVersionIds.has(version.id) && (
                      <div className="mt-3 space-y-2">
                        {loadingVersionIssues[version.id] ? (
                          <div className="py-4 flex items-center justify-center gap-2 text-xs text-jira-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
                            <span>Loading release issues...</span>
                          </div>
                        ) : (versionIssues[version.id] || []).length === 0 ? (
                          <div className="py-4 px-3 bg-jira-gray-50 border border-dashed border-jira-gray-300 rounded text-center text-xs text-jira-gray-500">
                            No issues assigned to this release. Click{" "}
                            {permissions.canManageVersions && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVersion(version);
                                  setIsCreateModalOpen(true);
                                }}
                                className="text-jira-blue font-semibold hover:underline inline"
                              >
                                Manage / Add Issues
                              </button>
                            )}{" "}
                            to set the Fix Version on issues.
                          </div>
                        ) : (
                          <div className="border border-jira-gray-200 rounded-md divide-y divide-jira-gray-200 overflow-hidden bg-white">
                            {(versionIssues[version.id] || []).map((issue) => (
                              <div
                                key={issue.id}
                                className="px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-jira-gray-50/70 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${getTypeColor(
                                      issue.type
                                    )}`}
                                  >
                                    {issue.type}
                                  </span>
                                  <Link
                                    href={`/projects/${project.key}/issues?selectedIssue=${issue.key}`}
                                    className="font-mono font-semibold text-jira-blue hover:underline shrink-0 flex items-center gap-1"
                                    title="View issue"
                                  >
                                    <span>{issue.key}</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-jira-gray-400" />
                                  </Link>
                                  <span className="text-jira-navy font-medium truncate" title={issue.title}>
                                    {issue.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  {issue.storyPoints !== undefined && issue.storyPoints !== null && (
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-jira-gray-100 text-jira-gray-700"
                                      title="Story Points"
                                    >
                                      {issue.storyPoints} pts
                                    </span>
                                  )}

                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadge(
                                      issue.category
                                    )}`}
                                  >
                                    {issue.status}
                                  </span>

                                  {issue.assignee ? (
                                    <div className="flex items-center gap-1.5" title={`Assignee: ${issue.assignee.name}`}>
                                      <UserAvatar user={issue.assignee} size="sm" />
                                      <span className="text-[11px] text-jira-gray-600 hidden md:inline max-w-[90px] truncate">
                                        {issue.assignee.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-jira-gray-400 italic">
                                      Unassigned
                                    </span>
                                  )}

                                  {permissions.canManageVersions && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIssue(version.id, issue.id)}
                                      disabled={removingIssueId === issue.id}
                                      className="p-1 text-jira-gray-400 hover:text-jira-red hover:bg-rose-50 rounded transition-colors disabled:opacity-50 ml-1"
                                      title="Remove issue from release"
                                    >
                                      {removingIssueId === issue.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <X className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateVersionModal
        projectId={project.id}
        version={editingVersion}
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingVersion(null);
        }}
        onSaved={handleVersionSaved}
      />

      {releasingVersion && (
        <ReleaseVersionModal
          version={releasingVersion}
          otherVersions={versions}
          isOpen={Boolean(releasingVersion)}
          onClose={() => setReleasingVersion(null)}
          onReleased={(updated) => {
            handleVersionSaved(updated);
            setReleasingVersion(null);
          }}
        />
      )}

      {notesVersion && (
        <ReleaseNotesModal
          version={notesVersion}
          isOpen={Boolean(notesVersion)}
          onClose={() => setNotesVersion(null)}
        />
      )}
    </div>
  );
}
