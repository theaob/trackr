"use client";

import { StatusBadge } from "@/components/common/IssueIcons";
import React, { useState, useEffect, useMemo } from "react";
import { Version, IssueType } from "@/types";
import {
  createVersion,
  updateVersion,
  getReleaseEligibleIssues,
} from "@/lib/actions/versions";
import {
  X,
  Calendar,
  Tag,
  FileText,
  Loader2,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Check,
} from "lucide-react";

interface CreateVersionModalProps {
  projectId: string;
  version?: Version | null;
  initialSelectedIssueIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: (version: Version) => void;
}

interface EligibleIssue {
  id: string;
  key: string;
  title: string;
  status: string;
  category: string;
  type: IssueType;
  storyPoints?: number | null;
  versionId?: string | null;
  version?: { id: string; name: string; status: string } | null;
  sprintId?: string | null;
  sprint?: { id: string; name: string; status: string } | null;
  isAssignedToCurrent?: boolean;
}

export default function CreateVersionModal({
  projectId,
  version,
  initialSelectedIssueIds,
  isOpen,
  onClose,
  onSaved,
}: CreateVersionModalProps) {
  const isEditing = Boolean(version);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issues selection state
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [eligibleIssues, setEligibleIssues] = useState<EligibleIssue[]>([]);
  const [sprints, setSprints] = useState<{ id: string; name: string; status: string }[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "DONE" | "IN_PROGRESS" | "TODO">("ALL");

  useEffect(() => {
    if (!isOpen) return;

    if (version) {
      setName(version.name);
      setDescription(version.description || "");
      setReleaseDate(
        version.releaseDate ? new Date(version.releaseDate).toISOString().split("T")[0] : ""
      );
    } else {
      setName("");
      setDescription("");
      setReleaseDate("");
    }
    setError(null);
    setIssueSearchQuery("");
    setCategoryFilter("ALL");

    // Fetch project issues to allow associating them with this release
    setIsLoadingIssues(true);
    getReleaseEligibleIssues(projectId, version?.id)
      .then((data) => {
        setEligibleIssues(data.issues as unknown as EligibleIssue[]);
        setSprints(data.sprints);

        if (version) {
          // Pre-select issues already belonging to this version
          const currentIds = new Set(
            data.issues.filter((i) => i.versionId === version.id).map((i) => i.id)
          );
          setSelectedIssueIds(currentIds);
        } else if (initialSelectedIssueIds && initialSelectedIssueIds.length > 0) {
          setSelectedIssueIds(new Set(initialSelectedIssueIds));
        } else {
          // By default when creating a release, pre-select unreleased DONE issues
          const unreleasedDone = data.issues
            .filter((i) => !i.versionId && (i.category === "DONE" || i.status === "DONE"))
            .map((i) => i.id);
          setSelectedIssueIds(new Set(unreleasedDone));
        }
      })
      .catch((err) => {
        console.error("Failed to load eligible issues:", err);
      })
      .finally(() => {
        setIsLoadingIssues(false);
      });
  }, [version, isOpen, projectId, initialSelectedIssueIds]);

  if (!isOpen) return null;

  // Count unreleased done issues
  const unreleasedDoneIssues = eligibleIssues.filter(
    (i) => !i.versionId && (i.category === "DONE" || i.status === "DONE")
  );

  // Filtered issues in the picker
  const filteredIssues = eligibleIssues.filter((i) => {
    if (categoryFilter !== "ALL" && i.category !== categoryFilter) {
      return false;
    }
    if (issueSearchQuery.trim()) {
      const q = issueSearchQuery.toLowerCase();
      const matchKey = i.key.toLowerCase().includes(q);
      const matchTitle = i.title.toLowerCase().includes(q);
      if (!matchKey && !matchTitle) return false;
    }
    return true;
  });

  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      filteredIssues.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIssueIds(new Set());
  };

  const handleSelectUnreleasedDone = () => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      unreleasedDoneIssues.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const handleSelectSprintIssues = (sprintId: string) => {
    if (!sprintId) return;
    const sprintIssues = eligibleIssues.filter((i) => i.sprintId === sprintId);
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      sprintIssues.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Version name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const issueIds = Array.from(selectedIssueIds);

    try {
      if (isEditing && version) {
        const res = await updateVersion(version.id, {
          name,
          description: description || null,
          startDate: null,
          releaseDate: releaseDate || null,
          issueIds,
        });

        if (res.success) {
          if (res.version) onSaved(res.version as unknown as Version);
          onClose();
        } else {
          setError(res.error || "Failed to update version");
        }
      } else {
        const res = await createVersion({
          projectId,
          name,
          description,
          startDate: null,
          releaseDate: releaseDate || null,
          issueIds,
        });

        if (res.success) {
          if (res.version) onSaved(res.version as unknown as Version);
          onClose();
        } else {
          setError(res.error || "Failed to create version");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-jira-gray-200 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-jira-blue" />
            <h2 className="text-base font-bold text-jira-navy">
              {isEditing ? "Edit Version" : "Create Version & Define Release"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-jira-gray-500 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
              {error}
            </div>
          )}

          {/* Version Name */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Version Name <span className="text-jira-red">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 1.0.0 or 2026.Q4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue focus:ring-1 focus:ring-jira-blue outline-none"
              autoFocus
              required
            />
          </div>

          {/* Release Date */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
              Release Date
            </label>
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-jira-gray-500" />
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief summary of goals or theme for this release..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none resize-none"
            />
          </div>

          {/* Assign Issues (Fix Version) Section */}
          <div className="pt-3 border-t border-jira-gray-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-jira-navy flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-jira-blue" />
                  Assign Issues to Release (Fix Version)
                </label>
                <p className="text-[11px] text-jira-gray-500">
                  Selected issues will have their <strong>Fix Version</strong> set to this release.
                </p>
              </div>

              <span className="text-xs font-bold text-jira-blue bg-blue-50 border border-jira-blue/30 px-2 py-0.5 rounded-full">
                {selectedIssueIds.size} selected
              </span>
            </div>

            {/* Quick Presets Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {unreleasedDoneIssues.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectUnreleasedDone}
                  className="text-[11px] font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                  title="Select all currently completed issues that do not have a release yet"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>All Unreleased Done ({unreleasedDoneIssues.length})</span>
                </button>
              )}

              {sprints.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    handleSelectSprintIssues(e.target.value);
                    e.target.value = "";
                  }}
                  className="text-[11px] font-medium px-2 py-1 rounded bg-jira-gray-100 text-jira-gray-700 border border-jira-gray-300 hover:bg-jira-gray-200 outline-none"
                >
                  <option value="" disabled>
                    + Add from Sprint...
                  </option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 px-2 py-1 rounded border border-jira-gray-200"
              >
                Select All
              </button>

              {selectedIssueIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-rose-600 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Filter Pills and Search */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-gray-400" />
                <input
                  type="text"
                  placeholder="Search issues by key or title..."
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                {(["ALL", "DONE", "IN_PROGRESS", "TODO"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-1 rounded transition-colors ${
                      categoryFilter === cat
                        ? "bg-jira-navy text-white font-semibold"
                        : "bg-jira-gray-100 text-jira-gray-600 hover:bg-jira-gray-200"
                    }`}
                  >
                    {cat === "ALL" ? "All" : cat === "DONE" ? "Done" : cat === "IN_PROGRESS" ? "In Progress" : "To Do"}
                  </button>
                ))}
              </div>
            </div>

            {/* Issues List Container */}
            <div className="border border-jira-gray-200 rounded-md overflow-hidden bg-slate-50/50">
              {isLoadingIssues ? (
                <div className="p-8 flex items-center justify-center text-xs text-jira-gray-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
                  <span>Loading project issues...</span>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="p-6 text-center text-xs text-jira-gray-500">
                  {eligibleIssues.length === 0
                    ? "No issues found in this project."
                    : "No issues match your search criteria."}
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-jira-gray-200/80">
                  {filteredIssues.map((issue) => {
                    const isSelected = selectedIssueIds.has(issue.id);
                    const isInOtherVersion =
                      issue.versionId && (!version || issue.versionId !== version.id);

                    return (
                      <div
                        key={issue.id}
                        onClick={() => toggleIssue(issue.id)}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer select-none transition-colors ${
                          isSelected
                            ? "bg-blue-50/70 hover:bg-blue-50"
                            : "bg-white hover:bg-jira-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-jira-blue focus:ring-jira-blue shrink-0 pointer-events-none"
                          />

                          <span className="min-w-[4.5rem] font-bold text-jira-navy text-[11px] shrink-0 font-mono">
                            {issue.key}
                          </span>

                          <span className="truncate text-jira-gray-800 text-[11px]" title={issue.title}>
                            {issue.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-[10px]">
                          {/* Other version badge */}
                          {isInOtherVersion && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium"
                              title={`Currently in version ${issue.version?.name || "another release"}. Selecting this will move it to ${name || "this release"}.`}
                            >
                              In {issue.version?.name}
                            </span>
                          )}

                          {/* Fixed-width status and points columns so rows line up. */}
                          <div className="w-28 flex justify-end">
                            <StatusBadge status={issue.status} className="text-[10px] max-w-full" />
                          </div>

                          <div className="w-4">
                            {issue.storyPoints != null && (
                              <span className="w-4 h-4 rounded-full bg-jira-gray-200 text-jira-gray-700 flex items-center justify-center font-bold text-[9px]">
                                {issue.storyPoints}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-jira-gray-200 shrink-0">
            <span className="text-xs text-jira-gray-500">
              {selectedIssueIds.size === 0
                ? "No issues selected."
                : `${selectedIssueIds.size} issue${selectedIssueIds.size === 1 ? "" : "s"} will have Fix Version set to ${name || "this release"}.`}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium px-4 py-2 rounded text-jira-gray-700 hover:bg-jira-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-xs font-semibold px-4 py-2 rounded bg-jira-blue text-white hover:bg-jira-blue-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Version"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
