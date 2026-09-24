"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Version, IssueType } from "@/types";
import { createVersion, updateVersion, getReleaseEligibleIssues } from "@/lib/actions/versions";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/reports/kit";

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

  const categoryLabel = (c: string) => (c === "DONE" ? "Done" : c === "IN_PROGRESS" ? "In progress" : "To do");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={isEditing ? `Edit ${version?.name}` : "Create version"}
        description="A version groups the issues that ship together. The chosen issues get it as their fix version."
        footer={
          <>
            <span className="mr-auto text-xs text-muted">
              {selectedIssueIds.size === 0 ? "No issues chosen." : `${selectedIssueIds.size} issue${selectedIssueIds.size === 1 ? "" : "s"} chosen.`}
            </span>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="version-form" variant="primary" loading={isSubmitting}>
              {isEditing ? "Save changes" : "Create version"}
            </Button>
          </>
        }
      >
        <form id="version-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_11rem] gap-3">
            <Field label="Name" required>
              <Input placeholder="1.0.0 or 2026.Q4" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Release date">
              <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} placeholder="What this release is about" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <fieldset className="space-y-2.5 border-t border-subtle pt-4">
            <legend className="sr-only">Issues in this version</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink-2">Issues</p>
              <span className="flex flex-wrap items-center gap-1.5">
                {unreleasedDoneIssues.length > 0 && (
                  <Button size="sm" onClick={handleSelectUnreleasedDone}>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Done, not released ({unreleasedDoneIssues.length})
                  </Button>
                )}
                {sprints.length > 0 && (
                  <select
                    aria-label="Add a sprint's issues"
                    defaultValue=""
                    onChange={(e) => {
                      handleSelectSprintIssues(e.target.value);
                      e.target.value = "";
                    }}
                    className="h-7 rounded-control border border-subtle bg-surface px-2 text-xs text-ink hover:border-strong"
                  >
                    <option value="" disabled>
                      Add a sprint&rsquo;s issues…
                    </option>
                    {sprints.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button size="sm" variant="ghost" onClick={handleSelectAllFiltered}>
                  Choose all shown
                </Button>
                {selectedIssueIds.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={handleClearSelection}>
                    Clear
                  </Button>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search issues"
                  placeholder="Search by key or title"
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-control border border-subtle bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
                />
              </div>
              <Segmented
                label="Show"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={(["ALL", "DONE", "IN_PROGRESS", "TODO"] as const).map((c) => ({ value: c, label: c === "ALL" ? "All" : categoryLabel(c) }))}
              />
            </div>
            <div className="overflow-hidden rounded-control border border-subtle">
              {isLoadingIssues ? (
                <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Loading issues…
                </p>
              ) : filteredIssues.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted">{eligibleIssues.length === 0 ? "This project has no issues yet." : "No issues match."}</p>
              ) : (
                <ul className="max-h-60 divide-y divide-subtle overflow-y-auto">
                  {filteredIssues.map((issue) => {
                    const isSelected = selectedIssueIds.has(issue.id);
                    const elsewhere = issue.versionId && (!version || issue.versionId !== version.id);
                    return (
                      <li key={issue.id}>
                        <label className={cn("flex h-9 cursor-pointer items-center gap-2.5 px-3 text-[13px]", isSelected ? "bg-accent-soft" : "hover:bg-surface-sunk")}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleIssue(issue.id)}
                            className="h-4 w-4 shrink-0 accent-[rgb(var(--color-accent))]"
                          />
                          <IssueTypeIcon type={issue.type} className="h-4 w-4 shrink-0" />
                          <span className="w-20 shrink-0 font-mono text-xs text-ink-2">{issue.key}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{issue.title}</span>
                          {elsewhere && <span className="shrink-0 rounded-full bg-warning-soft px-1.5 text-[11px] text-ink">In {issue.version?.name}</span>}
                          <span className="w-28 shrink-0 text-right">
                            <StatusLozenge label={prettifyStatusName(issue.status)} />
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
