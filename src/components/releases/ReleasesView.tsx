"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Project, Version, VersionStatus } from "@/types";
import { archiveVersion, deleteVersion, getVersionIssues, removeIssueFromVersion } from "@/lib/actions/versions";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { issueHref } from "@/lib/issueUrls";
import { formatCalendarDate, isCalendarDateBeforeToday } from "@/lib/calendarDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import UserAvatar from "@/components/common/UserAvatar";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { Segmented, series } from "@/components/reports/kit";
import CreateVersionModal from "./CreateVersionModal";
import ReleaseVersionModal from "./ReleaseVersionModal";
import ReleaseNotesModal from "./ReleaseNotesModal";

interface ReleasesViewProps {
  project: Project;
  initialVersions: Version[];
}

type Filter = VersionStatus | "ALL";
const EMPTY_COUNTS = { total: 0, done: 0, inProgress: 0, todo: 0, storyPoints: 0, completedStoryPoints: 0 };
const cell = "h-list-row border-b border-subtle px-2.5 text-[13px]";

function VersionStatusLozenge({ version }: { version: Version }) {
  if (version.status === "RELEASED") return <StatusLozenge label="Released" token="success" />;
  if (version.status === "ARCHIVED") return <StatusLozenge label="Archived" />;
  if (isCalendarDateBeforeToday(version.releaseDate)) return <StatusLozenge label="Overdue" token="danger" />;
  return <StatusLozenge label="Unreleased" token="accent" />;
}

/** Done, in progress and to do as one bar, with a 2px gap between the parts. */
function ProgressBar({ counts }: { counts: typeof EMPTY_COUNTS }) {
  const parts = [
    { n: counts.done, color: series(1) },
    { n: counts.inProgress, color: series("1-soft") },
    { n: counts.todo, color: "rgb(var(--color-border-strong))" },
  ].filter((p) => p.n > 0);
  return (
    <span aria-hidden="true" className="flex h-2 w-full gap-0.5 overflow-hidden rounded-[3px] bg-surface-sunk">
      {parts.map((p, i) => (
        <span key={i} className="h-full" style={{ width: `${(p.n / Math.max(1, counts.total)) * 100}%`, backgroundColor: p.color }} />
      ))}
    </span>
  );
}

/**
 * The project's versions as a table: status, release date and progress, with
 * the issues of each a click away. Styled like the Issues table.
 */
export default function ReleasesView({ project, initialVersions }: ReleasesViewProps) {
  const permissions = useProjectPermissions(project);
  const { toast: showToast } = useToast();
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [releasingVersion, setReleasingVersion] = useState<Version | null>(null);
  const [notesVersion, setNotesVersion] = useState<Version | null>(null);
  const [deleting, setDeleting] = useState<Version | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [versionIssues, setVersionIssues] = useState<Record<string, any[]>>({});
  const [loadingIssues, setLoadingIssues] = useState<Record<string, boolean>>({});
  const [removingIssueId, setRemovingIssueId] = useState<string | null>(null);

  const toggleExpanded = async (versionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
    if (!versionIssues[versionId] && !loadingIssues[versionId]) {
      setLoadingIssues((prev) => ({ ...prev, [versionId]: true }));
      try {
        const issues = await getVersionIssues(versionId);
        setVersionIssues((prev) => ({ ...prev, [versionId]: issues }));
      } finally {
        setLoadingIssues((prev) => ({ ...prev, [versionId]: false }));
      }
    }
  };

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
    if (saved.id && (expanded.has(saved.id) || versionIssues[saved.id])) {
      getVersionIssues(saved.id).then((fresh) => setVersionIssues((prev) => ({ ...prev, [saved.id]: fresh })));
    }
  };

  const handleRemoveIssue = async (versionId: string, issueId: string) => {
    setRemovingIssueId(issueId);
    try {
      const res = await removeIssueFromVersion(issueId);
      if (res.success) {
        setVersionIssues((prev) => ({ ...prev, [versionId]: (prev[versionId] || []).filter((i) => i.id !== issueId) }));
        if (res.version) handleVersionSaved(res.version as unknown as Version);
      } else {
        showToast({ title: "Couldn't remove the issue", tone: "danger" });
      }
    } finally {
      setRemovingIssueId(null);
    }
  };

  const handleArchiveToggle = async (v: Version) => {
    const res = await archiveVersion(v.id, v.status !== "ARCHIVED");
    if (res.success && res.version) {
      setVersions((prev) => prev.map((item) => (item.id === v.id ? (res.version as unknown as Version) : item)));
      showToast({ title: v.status === "ARCHIVED" ? `${v.name} restored` : `${v.name} archived`, tone: "success" });
    } else {
      showToast({ title: "Couldn't change the version", tone: "danger" });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await deleteVersion(deleting.id);
    setDeleteBusy(false);
    if (res.success) {
      setVersions((prev) => prev.filter((item) => item.id !== deleting.id));
      showToast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
    } else {
      showToast({ title: "Couldn't delete the version", tone: "danger" });
    }
  };

  const openCreate = (v: Version | null) => {
    setEditingVersion(v);
    setIsCreateModalOpen(true);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return versions.filter((v) => {
      if (filter !== "ALL" && v.status !== filter) return false;
      if (q && !v.name.toLowerCase().includes(q) && !v.description?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [versions, filter, query]);

  const count = (s: VersionStatus) => versions.filter((v) => v.status === s).length;
  const canManage = permissions.canManageVersions;

  // ?create=1 (from ⌘K's "Create release") opens the dialog once, then leaves the address.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wantsCreate = searchParams?.get("create") === "1";
  useEffect(() => {
    if (!wantsCreate) return;
    if (canManage) openCreate(null);
    router.replace(pathname ?? "", { scroll: false });
    // Only when the address asks for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsCreate]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-page">
      <header className="shrink-0 space-y-4 border-b border-subtle bg-surface px-3 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">Releases</h1>
            <p className="mt-0.5 text-xs text-muted">Versions of {project.name}, their progress and their release notes.</p>
          </div>
          {canManage && (
            <Button variant="primary" onClick={() => openCreate(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create version
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: `All ${versions.length}` },
              { value: "UNRELEASED", label: `Unreleased ${count("UNRELEASED")}` },
              { value: "RELEASED", label: `Released ${count("RELEASED")}` },
              { value: "ARCHIVED", label: `Archived ${count("ARCHIVED")}` },
            ]}
          />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search versions"
              placeholder="Search versions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full rounded-control border border-subtle bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <Package className="h-8 w-8 text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">{query || filter !== "ALL" ? "No versions match" : "No versions yet"}</h2>
            <p className="max-w-sm text-xs text-muted">
              {query || filter !== "ALL" ? "Clear the search or show all versions." : "Create a version to plan what ships together."}
            </p>
            {canManage && !query && filter === "ALL" && (
              <Button variant="primary" className="mt-2" onClick={() => openCreate(null)}>
                Create version
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-subtle bg-surface">
            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs font-medium text-ink-2">
                  <th scope="col" className="h-9 w-9 border-b border-subtle">
                    <span className="sr-only">Issues</span>
                  </th>
                  <th scope="col" className="h-9 border-b border-subtle px-2.5 font-medium">
                    Version
                  </th>
                  <th scope="col" className="h-9 w-32 border-b border-subtle px-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="h-9 w-32 border-b border-subtle px-2.5 font-medium">
                    Release date
                  </th>
                  <th scope="col" className="h-9 w-56 border-b border-subtle px-2.5 font-medium">
                    Progress
                  </th>
                  <th scope="col" className="h-9 w-40 border-b border-subtle px-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((version) => {
                  const counts = version.issueCount || EMPTY_COUNTS;
                  const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
                  const isOpen = expanded.has(version.id);
                  const late = version.status === "UNRELEASED" && isCalendarDateBeforeToday(version.releaseDate);
                  const issues = versionIssues[version.id] || [];
                  return (
                    <React.Fragment key={version.id}>
                      <tr className="hover:bg-surface-sunk/60">
                        <td className={cn(cell, "px-1.5")}>
                          <IconButton
                            size="sm"
                            label={`${isOpen ? "Hide" : "Show"} the issues in ${version.name}`}
                            aria-expanded={isOpen}
                            onClick={() => toggleExpanded(version.id)}
                            icon={<ChevronRight className={cn("transition-transform", isOpen && "rotate-90")} aria-hidden="true" />}
                          />
                        </td>
                        <td className={cn(cell, "min-w-0")}>
                          <span className="block truncate font-medium text-ink">{version.name}</span>
                          {version.description && <span className="block truncate text-xs text-muted">{version.description}</span>}
                        </td>
                        <td className={cell}>
                          <VersionStatusLozenge version={version} />
                        </td>
                        <td className={cn(cell, late ? "font-medium text-danger" : "text-ink-2")}>
                          {version.releaseDate ? (
                            formatCalendarDate(version.releaseDate, "MMM d, yyyy")
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                        <td className={cell}>
                          <span className="flex items-center gap-2.5">
                            <ProgressBar counts={counts} />
                            <span className="shrink-0 text-xs tabular-nums text-ink-2">
                              {counts.done}/{counts.total}
                              <span className="sr-only">
                                {" "}
                                issues done, {pct}%, {counts.inProgress} in progress, {counts.todo} to do
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={cn(cell, "text-right")}>
                          <span className="inline-flex items-center gap-1">
                            {canManage && version.status === "UNRELEASED" && (
                              <Button size="sm" onClick={() => setReleasingVersion(version)}>
                                <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                                Release
                              </Button>
                            )}
                            <Menu>
                              <MenuTrigger asChild>
                                <IconButton
                                  size="sm"
                                  label={`More actions for ${version.name}`}
                                  icon={<MoreHorizontal aria-hidden="true" />}
                                />
                              </MenuTrigger>
                              <MenuContent align="end">
                                <MenuItem icon={<FileText aria-hidden="true" />} onSelect={() => setNotesVersion(version)}>
                                  Release notes
                                </MenuItem>
                                {canManage && (
                                  <>
                                    <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => openCreate(version)}>
                                      Edit and add issues…
                                    </MenuItem>
                                    <MenuItem
                                      icon={
                                        version.status === "ARCHIVED" ? (
                                          <ArchiveRestore aria-hidden="true" />
                                        ) : (
                                          <Archive aria-hidden="true" />
                                        )
                                      }
                                      onSelect={() => handleArchiveToggle(version)}
                                    >
                                      {version.status === "ARCHIVED" ? "Restore" : "Archive"}
                                    </MenuItem>
                                    <MenuSeparator />
                                    <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => setDeleting(version)}>
                                      Delete…
                                    </MenuItem>
                                  </>
                                )}
                              </MenuContent>
                            </Menu>
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="border-b border-subtle bg-page p-0">
                            {loadingIssues[version.id] ? (
                              <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                Loading issues…
                              </p>
                            ) : issues.length === 0 ? (
                              <p className="px-12 py-4 text-xs text-muted">
                                No issues have this fix version yet.
                                {canManage && (
                                  <>
                                    {" "}
                                    <button
                                      type="button"
                                      onClick={() => openCreate(version)}
                                      className="font-medium text-accent hover:underline"
                                    >
                                      Add issues
                                    </button>
                                  </>
                                )}
                              </p>
                            ) : (
                              <ul aria-label={`Issues in ${version.name}`} className="divide-y divide-subtle">
                                {issues.map((issue) => (
                                  <li key={issue.id} className="flex h-10 items-center gap-2.5 pl-12 pr-3 text-[13px]">
                                    <IssueTypeIcon type={issue.type} className="h-4 w-4 shrink-0" />
                                    <Link
                                      prefetch={false}
                                      href={issueHref(project.key, issue.key)}
                                      className="w-24 shrink-0 font-mono text-xs text-ink-2 hover:text-ink hover:underline"
                                    >
                                      {issue.key}
                                    </Link>
                                    <span className="min-w-0 flex-1 truncate text-ink">{issue.title}</span>
                                    <span className="w-8 shrink-0 text-right font-mono text-xs text-ink-2">{issue.storyPoints ?? "–"}</span>
                                    <span className="w-32 shrink-0">
                                      <StatusLozenge label={prettifyStatusName(issue.status)} />
                                    </span>
                                    <span className="flex w-36 shrink-0 items-center gap-1.5 text-xs text-ink-2">
                                      {issue.assignee ? (
                                        <>
                                          <UserAvatar user={issue.assignee} size="xs" />
                                          <span className="truncate">{issue.assignee.name}</span>
                                        </>
                                      ) : (
                                        "Unassigned"
                                      )}
                                    </span>
                                    {canManage && (
                                      <IconButton
                                        size="sm"
                                        label={`Remove ${issue.key} from ${version.name}`}
                                        disabled={removingIssueId === issue.id}
                                        onClick={() => handleRemoveIssue(version.id, issue.id)}
                                        icon={
                                          removingIssueId === issue.id ? (
                                            <Loader2 className="animate-spin" aria-hidden="true" />
                                          ) : (
                                            <X aria-hidden="true" />
                                          )
                                        }
                                      />
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {notesVersion && <ReleaseNotesModal version={notesVersion} isOpen={Boolean(notesVersion)} onClose={() => setNotesVersion(null)} />}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting && (
          <DialogContent
            size="sm"
            title={`Delete ${deleting.name}?`}
            description="Its issues stay, without this fix version. This can't be undone."
            footer={
              <>
                <Button onClick={() => setDeleting(null)}>Cancel</Button>
                <Button variant="danger" loading={deleteBusy} onClick={confirmDelete}>
                  Delete version
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}
