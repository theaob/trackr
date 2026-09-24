"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  Download,
  Loader2,
  Rows3,
  Rows4,
  Settings2,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import type { Issue, IssueStatus, Label, PriorityLevel, Project, Sprint, User, Version, WorkflowStatus } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { bulkDeleteIssues, bulkUpdateIssues, getPaginatedIssues } from "@/lib/actions/issues";
import { bulkAddLabel } from "@/lib/actions/labels";
import { createSavedView, deleteSavedView, updateSavedView } from "@/lib/actions/savedViews";
import IssueView from "@/components/issue/IssueView";
import IssuePanel from "@/components/issue/IssuePanel";
import { useIssueStepper } from "@/components/issue/useIssueStepper";
import TQLQueryBar from "@/components/issues/tql/TQLQueryBar";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/Menu";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import FilterBar, { type FilterOptions } from "./list/FilterBar";
import IssueTable from "./list/IssueTable";
import { useAppearance } from "@/hooks/useAppearance";
import ViewsMenu from "./list/ViewsMenu";
import {
  BUILT_IN_VIEWS,
  COLUMNS,
  DEFAULT_COLUMNS,
  matchesView,
  normalizeColumns,
  queryForView,
  queryToTQL,
  tqlToQuery,
  viewQuery,
  type ColumnId,
  type IssueQuery,
  type SortField,
  type ViewDefinition,
} from "@/lib/issueQuery";
import { issuesToCSV } from "@/lib/issueCsv";
import type { TQLAutocompleteContext } from "@/lib/tql/autocomplete";
import { formatCalendarDate } from "@/lib/calendarDate";
import { isOverdue } from "@/lib/dueDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Popover";

interface IssuesListViewProps {
  project: Project;
  allProjects?: Project[];
  initialIssues: Issue[];
  initialTotalCount?: number;
  initialPage?: number;
  initialPageSize?: number;
  initialTotalPages?: number;
  users: User[];
  sprints: Sprint[];
  versions?: Version[];
  statuses: WorkflowStatus[];
  labels?: Label[];
  initialSelectedIssueKey?: string;
  /** "tql" opens the TQL editor rather than the chips. */
  initialFilterMode?: "basic" | "tql";
  /** A query from the address (?tql=). */
  initialTqlQuery?: string;
  /** A view to open (?view=). */
  initialViewId?: string;
  initialSavedViews?: ViewDefinition[];
  /** The TQL the server already ran for the first page, so it isn't fetched twice. */
  initialFetchedTql?: string;
}

export function resolveNextSelectedIssueId(prevId: string | null, issues: { id: string }[]): string | null {
  if (!prevId || issues.length === 0) return null;
  return issues.some((i) => i.id === prevId) ? prevId : null;
}

const PRIORITIES: PriorityLevel[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];
/** Sorting a column for the first time: newest first for dates, A to Z otherwise. */
const FIRST_DIRECTION: Record<SortField, "ASC" | "DESC"> = {
  key: "ASC",
  title: "ASC",
  type: "ASC",
  status: "ASC",
  priority: "DESC",
  points: "DESC",
  created: "DESC",
  updated: "DESC",
  duedate: "ASC",
};

export default function IssuesListView({
  project,
  allProjects = [],
  initialIssues,
  initialTotalCount,
  initialPage,
  initialPageSize,
  initialTotalPages,
  users,
  sprints,
  versions = [],
  statuses,
  labels = [],
  initialSelectedIssueKey,
  initialFilterMode,
  initialTqlQuery,
  initialViewId,
  initialSavedViews = [],
  initialFetchedTql,
}: IssuesListViewProps) {
  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(project);
  const { searchQuery: globalSearchQuery } = useSearch();
  const { toast } = useToast();

  // ---- The query: views, chips and TQL all come down to this -----------------
  const [savedViews, setSavedViews] = useState<ViewDefinition[]>(initialSavedViews);
  const allViews = useMemo(() => [...BUILT_IN_VIEWS, ...savedViews], [savedViews]);

  const initial = useMemo(() => {
    const fromUrl = initialTqlQuery?.trim() ? tqlToQuery(initialTqlQuery) : null;
    if (fromUrl?.ok) return { query: fromUrl.query, columns: DEFAULT_COLUMNS, viewId: null as string | null };
    const view = allViews.find((v) => v.id === initialViewId) ?? BUILT_IN_VIEWS[0];
    return { query: viewQuery(view, project.key), columns: normalizeColumns(view.columns), viewId: view.id };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first render's address counts
  }, []);

  const [query, setQuery] = useState<IssueQuery>(initial.query);
  const [columns, setColumns] = useState<ColumnId[]>(initial.columns);
  const [activeViewId, setActiveViewId] = useState<string | null>(initial.viewId);
  const [mode, setMode] = useState<"chips" | "tql">(initialFilterMode === "tql" ? "tql" : "chips");
  const [tqlDraft, setTqlDraft] = useState(() => initialTqlQuery?.trim() || queryToTQL(initial.query));
  const [tqlError, setTqlError] = useState<string | null>(
    initialTqlQuery?.trim() && !tqlToQuery(initialTqlQuery).ok ? "That query has an error; fix it and press Enter." : null
  );

  const activeView = allViews.find((v) => v.id === activeViewId) ?? null;
  const modified = !!activeView && !matchesView(activeView, query, columns);
  const tql = useMemo(() => queryToTQL(query), [query]);

  const changeQuery = (next: IssueQuery) => {
    setQuery(next);
    setPage(1);
  };

  // ---- Data ------------------------------------------------------------------
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [totalCount, setTotalCount] = useState(initialTotalCount ?? initialIssues.length);
  const [page, setPage] = useState(initialPage ?? 1);
  const [pageSize, setPageSize] = useState(initialPageSize ?? 50);
  const [totalPages, setTotalPages] = useState(initialTotalPages ?? 1);
  const [isLoading, setIsLoading] = useState(false);

  const [viewMode, setViewMode] = useState<"split" | "table">("split");
  // Density is the account menu's setting; the toolbar button changes it too.
  const { density, setDensity: changeDensity } = useAppearance();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [labelDialog, setLabelDialog] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    initialSelectedIssueKey
      ? (initialIssues.find((i) => i.key.toUpperCase() === initialSelectedIssueKey.toUpperCase() || i.id === initialSelectedIssueKey)?.id ??
          null)
      : null
  );
  const [panelIssue, setPanelIssue] = useState<Issue | null>(null);

  const projectIdFor = useCallback(
    (key: string | null) => {
      if (!key) return "ALL";
      if (key === project.key) return project.id;
      return allProjects.find((p) => p.key === key)?.id ?? "ALL";
    },
    [allProjects, project.id, project.key]
  );

  const requestRef = useRef(0);
  const fetchIssues = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      const request = ++requestRef.current;
      if (!background) setIsLoading(true);
      try {
        const res = await getPaginatedIssues({
          projectId: projectIdFor(query.filters.projectKey),
          page,
          pageSize,
          tql,
          currentUserId: currentUser?.id,
        });
        if (request !== requestRef.current) return;
        if ("error" in res && res.error) {
          setTqlError(String(res.error));
          return;
        }
        setIssues(res.issues as unknown as Issue[]);
        setTotalCount(res.totalCount);
        setTotalPages(res.totalPages);
        const listed = new Set(res.issues.map((i) => i.id));
        setSelectedIds((prev) => (background ? new Set([...prev].filter((id) => listed.has(id))) : new Set()));
        setSelectedIssueId((prev) => resolveNextSelectedIssueId(prev, res.issues));
      } catch (err) {
        console.error("Failed to load issues", err);
      } finally {
        if (!background && request === requestRef.current) setIsLoading(false);
      }
    },
    [projectIdFor, query.filters.projectKey, page, pageSize, tql, currentUser?.id]
  );

  // The first render has the server's page for the starting query already.
  const firstFetch = useRef(true);
  useEffect(() => {
    if (firstFetch.current) {
      firstFetch.current = false;
      if (tql === initialFetchedTql) return;
    }
    const timer = setTimeout(() => fetchIssues(), 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchIssues changes with everything it depends on
  }, [fetchIssues]);

  useRefetchOnFocus(() => fetchIssues({ background: true }));

  // The address follows the page, so a view or query can be shared or bookmarked.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.delete("tql");
    url.searchParams.delete("view");
    if (activeView && !modified) {
      if (activeView.id !== BUILT_IN_VIEWS[0].id) url.searchParams.set("view", activeView.id);
    } else {
      url.searchParams.set("tql", tql);
    }
    const next = `${url.pathname}${url.search}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [activeView, modified, tql]);

  // The top bar's filter box searches this list.
  useEffect(() => {
    if (globalSearchQuery) changeQuery({ ...query, filters: { ...query.filters, text: globalSearchQuery } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new search from the top bar
  }, [globalSearchQuery]);

  // A new issue created anywhere shows up here if it's in the project on screen.
  useEffect(() => {
    const onCreated = (e: Event) => {
      const created = (e as CustomEvent<{ issue?: Issue }>).detail?.issue;
      if (!created) return;
      if (query.filters.projectKey && created.projectId !== projectIdFor(query.filters.projectKey)) return;
      setIssues((prev) => (prev.some((i) => i.id === created.id) ? prev : [created, ...prev]));
      setTotalCount((n) => n + 1);
    };
    window.addEventListener("trackr:issue-created", onCreated);
    return () => window.removeEventListener("trackr:issue-created", onCreated);
  }, [query.filters.projectKey, projectIdFor]);

  // ---- Views -------------------------------------------------------------------
  const selectView = (view: ViewDefinition) => {
    const next = viewQuery(view, project.key);
    setActiveViewId(view.id);
    setColumns(normalizeColumns(view.columns));
    setMode("chips");
    setTqlError(null);
    setTqlDraft(queryToTQL(next));
    changeQuery(next);
  };

  const createView = async (name: string) => {
    const res = await createSavedView({ name, tql: queryForView(query), columns });
    if (!res.success) return res.error;
    setSavedViews((prev) => [...prev, res.view]);
    setActiveViewId(res.view.id);
    toast({ title: `Saved “${res.view.name}”`, tone: "success", duration: 2500 });
    return null;
  };

  const saveViewChanges = async (view: ViewDefinition) => {
    const res = await updateSavedView(view.id, { tql: queryForView(query), columns });
    if (!res.success) {
      toast({ title: "Couldn't save the view", description: res.error, tone: "danger" });
      return;
    }
    setSavedViews((prev) => prev.map((v) => (v.id === view.id ? res.view : v)));
    toast({ title: `Saved changes to “${res.view.name}”`, tone: "success", duration: 2500 });
  };

  const renameView = async (view: ViewDefinition, name: string) => {
    const res = await updateSavedView(view.id, { name });
    if (!res.success) return res.error;
    setSavedViews((prev) => prev.map((v) => (v.id === view.id ? res.view : v)));
    return null;
  };

  const deleteView = async (view: ViewDefinition) => {
    const res = await deleteSavedView(view.id);
    if (!res.success) return res.error;
    setSavedViews((prev) => prev.filter((v) => v.id !== view.id));
    if (activeViewId === view.id) setActiveViewId(null);
    toast({ title: `Deleted “${view.name}”`, tone: "success", duration: 2500 });
    return null;
  };

  // ---- TQL -------------------------------------------------------------------------
  const editAsTQL = () => {
    setTqlDraft(tql);
    setTqlError(null);
    setMode("tql");
  };

  const runTQL = () => {
    const parsed = tqlToQuery(tqlDraft);
    if (!parsed.ok) {
      setTqlError(parsed.error);
      return;
    }
    setTqlError(null);
    changeQuery(parsed.query);
  };

  const backToChips = () => {
    const parsed = tqlToQuery(tqlDraft);
    if (!parsed.ok) {
      setTqlError(`Fix the query first: ${parsed.error}`);
      return;
    }
    setTqlError(null);
    changeQuery(parsed.query);
    setMode("chips");
  };

  const autocomplete: TQLAutocompleteContext = useMemo(
    () => ({
      projects: (allProjects.length ? allProjects : [project]).map((p) => ({ key: p.key, name: p.name })),
      statuses: statuses.map((s) => s.name),
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email || undefined })),
      sprints: sprints.map((s) => s.name),
      versions: versions.map((v) => v.name),
      labels: labels.map((l) => l.name),
    }),
    [allProjects, project, statuses, users, sprints, versions, labels]
  );

  const filterOptions: FilterOptions = useMemo(
    () => ({
      statuses: statuses.filter((s, i, all) => all.findIndex((x) => x.name === s.name) === i).map((s) => ({ name: s.name, color: s.color })),
      users,
      sprints: sprints.map((s) => ({ name: s.name, status: s.status })),
      versions: versions.map((v) => v.name),
      labels: labels.map((l) => l.name),
      projects: (allProjects.length ? allProjects : [project]).map((p) => ({ key: p.key, name: p.name })),
      signedIn: !!currentUser,
    }),
    [statuses, users, sprints, versions, labels, allProjects, project, currentUser]
  );

  // ---- Sorting and columns -------------------------------------------------------------
  const sortBy = (field: SortField) =>
    changeQuery({
      ...query,
      sort: query.sort.field === field ? { field, direction: query.sort.direction === "ASC" ? "DESC" : "ASC" } : { field, direction: FIRST_DIRECTION[field] },
    });

  const toggleColumn = (id: ColumnId) => setColumns((prev) => normalizeColumns(prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  // ---- Bulk actions (table) ----------------------------------------------------------------
  const canSelect = permissions.canEditIssue || permissions.canDeleteIssue;
  const runBulk = async (
    what: string,
    action: () => Promise<{ success: true; succeeded: number; failed: { id: string; error: string }[] } | { success: false; error: string }>
  ) => {
    setBulkBusy(true);
    const res = await action();
    setBulkBusy(false);
    if (!res.success) {
      toast({ title: `Couldn't ${what}`, description: res.error, tone: "danger" });
      return;
    }
    if (res.failed.length) {
      toast({
        title: `${res.succeeded} of ${res.succeeded + res.failed.length} issues changed`,
        description: res.failed[0].error,
        tone: "danger",
      });
    } else {
      toast({ title: `Changed ${res.succeeded} ${res.succeeded === 1 ? "issue" : "issues"}`, tone: "success", duration: 2500 });
    }
    await fetchIssues();
  };
  const ids = () => [...selectedIds];

  const exportCSV = () => {
    const blob = new Blob([issuesToCSV(issues, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${query.filters.projectKey ?? "all"}-issues.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // ---- Issue open in the split view or the panel ---------------------------------------------
  const doneStatusNames = useMemo(() => statuses.filter((s) => s.category === "DONE").map((s) => s.name), [statuses]);
  const statusColor = useCallback((name: string) => statuses.find((s) => s.name === name)?.color, [statuses]);
  const selectedIssue = useMemo(() => issues.find((i) => i.id === selectedIssueId) ?? issues[0] ?? null, [selectedIssueId, issues]);
  const isMobileDetailOpen = Boolean(selectedIssueId);
  const handleUpdated = useCallback((updated: Issue) => setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i))), []);
  const handleDeleted = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
    setSelectedIssueId((prev) => (prev === id ? null : prev));
    setPanelIssue((prev) => (prev?.id === id ? null : prev));
  }, []);
  const splitNav = useIssueStepper(selectedIssue, issues, (next) => setSelectedIssueId(next.id));

  const pageButton = "inline-flex h-7 w-7 items-center justify-center rounded-control text-ink-2 hover:bg-surface-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-page">
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-subtle bg-surface px-3 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Issues</h1>
          <span className="font-mono text-xs text-ink-2">{totalCount.toLocaleString()}</span>
          <ViewsMenu
            builtIn={BUILT_IN_VIEWS}
            saved={savedViews}
            active={activeView}
            modified={modified}
            canSave={!!currentUser}
            onSelect={selectView}
            onCreate={createView}
            onSaveChanges={saveViewChanges}
            onRename={renameView}
            onDelete={deleteView}
          />
          <div className="ml-auto flex items-center gap-1">
            <div role="group" aria-label="Layout" className="flex items-center rounded-control border border-subtle p-0.5">
              <Tooltip content="List and issue side by side">
                <button
                  type="button"
                  aria-pressed={viewMode === "split"}
                  onClick={() => setViewMode("split")}
                  className="inline-flex h-6 items-center gap-1 rounded-[4px] px-2 text-xs text-ink-2 hover:text-ink aria-pressed:bg-surface-sunk aria-pressed:text-ink"
                >
                  <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Split</span>
                  <span className="sr-only sm:hidden">Split</span>
                </button>
              </Tooltip>
              <Tooltip content="Table">
                <button
                  type="button"
                  aria-pressed={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                  className="inline-flex h-6 items-center gap-1 rounded-[4px] px-2 text-xs text-ink-2 hover:text-ink aria-pressed:bg-surface-sunk aria-pressed:text-ink"
                >
                  <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Table</span>
                  <span className="sr-only sm:hidden">Table</span>
                </button>
              </Tooltip>
            </div>
            {viewMode === "table" && (
              <>
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton label="Columns" icon={<Settings2 />} size="sm" />
                  </MenuTrigger>
                  <MenuContent align="end" className="max-h-80 overflow-y-auto">
                    <MenuLabel>Columns</MenuLabel>
                    {COLUMNS.filter((c) => !c.required).map((c) => (
                      <MenuCheckboxItem key={c.id} checked={columns.includes(c.id)} onCheckedChange={() => toggleColumn(c.id)} onSelect={(e) => e.preventDefault()}>
                        {c.label}
                      </MenuCheckboxItem>
                    ))}
                  </MenuContent>
                </Menu>
                <IconButton
                  label={density === "compact" ? "Comfortable rows" : "Compact rows"}
                  icon={density === "compact" ? <Rows3 /> : <Rows4 />}
                  size="sm"
                  aria-pressed={density === "compact"}
                  onClick={() => changeDensity(density === "compact" ? "comfortable" : "compact")}
                />
              </>
            )}
            <IconButton label="Export CSV" icon={<Download />} size="sm" onClick={exportCSV} />
          </div>
        </div>

        {mode === "chips" ? (
          <FilterBar filters={query.filters} onChange={(filters) => changeQuery({ ...query, filters })} options={filterOptions} onEditTQL={editAsTQL} />
        ) : (
          <div className="flex flex-col gap-1">
            <TQLQueryBar
              query={tqlDraft}
              onChange={(q) => {
                setTqlDraft(q);
                setTqlError(null);
              }}
              onSearch={runTQL}
              onSwitchToBasic={backToChips}
              isLoading={isLoading}
              context={autocomplete}
            />
            {tqlError && (
              <p role="alert" className="text-xs text-danger">
                {tqlError}
              </p>
            )}
          </div>
        )}
      </div>

      {viewMode === "table" && canSelect && selectedIds.size > 0 && (
        <div role="toolbar" aria-label="Selected issues" className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-subtle bg-accent-soft px-3 py-2 sm:px-6">
          <span className="px-1 text-[13px] font-medium text-ink">{selectedIds.size} selected</span>
          {permissions.canEditIssue && (
            <>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="sm" disabled={bulkBusy}>
                    Status…
                  </Button>
                </MenuTrigger>
                <MenuContent className="max-h-80 overflow-y-auto">
                  {filterOptions.statuses.map((s) => (
                    <MenuItem key={s.name} onSelect={() => runBulk("change the status", () => bulkUpdateIssues(ids(), { status: s.name as IssueStatus }))}>
                      {prettifyStatusName(s.name)}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="sm" disabled={bulkBusy}>
                    Assignee…
                  </Button>
                </MenuTrigger>
                <MenuContent className="max-h-80 overflow-y-auto">
                  <MenuItem onSelect={() => runBulk("unassign", () => bulkUpdateIssues(ids(), { assigneeId: null }))}>Unassigned</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} icon={<UserAvatar user={u} size="xs" />} onSelect={() => runBulk("assign", () => bulkUpdateIssues(ids(), { assigneeId: u.id }))}>
                      {u.name}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="sm" disabled={bulkBusy}>
                    Priority…
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p} icon={<PriorityIcon priority={p} className="h-4 w-4" />} onSelect={() => runBulk("change the priority", () => bulkUpdateIssues(ids(), { priority: p }))}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
              {versions.length > 0 && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="sm" disabled={bulkBusy}>
                      Fix version…
                    </Button>
                  </MenuTrigger>
                  <MenuContent className="max-h-80 overflow-y-auto">
                    <MenuItem onSelect={() => runBulk("clear the version", () => bulkUpdateIssues(ids(), { versionId: null }))}>No version</MenuItem>
                    {versions.map((v) => (
                      <MenuItem key={v.id} onSelect={() => runBulk("set the version", () => bulkUpdateIssues(ids(), { versionId: v.id }))}>
                        {v.name}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              )}
              <Button size="sm" disabled={bulkBusy} onClick={() => setLabelDialog(true)}>
                Add label…
              </Button>
            </>
          )}
          {permissions.canDeleteIssue && (
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setDeleteDialog(true)} className="text-danger hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete…
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
          {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-accent" aria-label="Working" />}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {viewMode === "split" ? (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <ul
              aria-label="Issues"
              className={cn(
                "w-full shrink-0 divide-y divide-subtle overflow-y-auto border-r border-subtle bg-surface md:w-80 lg:w-96",
                isMobileDetailOpen ? "hidden md:block" : "block"
              )}
            >
              {issues.length === 0 ? (
                <li className="p-8 text-center text-[13px] text-ink-2">{isLoading ? "Loading…" : "No issues match these filters."}</li>
              ) : (
                issues.map((issue) => {
                  const selected = selectedIssue?.id === issue.id;
                  const late = !!issue.dueDate && isOverdue(issue.dueDate, issue.status, doneStatusNames);
                  return (
                    <li key={issue.id}>
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={cn(
                          "flex w-full flex-col gap-1.5 border-l-2 px-3 py-2.5 text-left transition-colors",
                          selected ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-sunk"
                        )}
                      >
                        <span className="flex w-full items-center gap-2">
                          <IssueTypeIcon type={issue.type} className="h-4 w-4 shrink-0" />
                          <span className="font-mono text-xs text-ink-2">{issue.key}</span>
                          <span className="ml-auto flex items-center gap-1.5">
                            <PriorityIcon priority={issue.priority} className="h-4 w-4" />
                            <StatusLozenge label={prettifyStatusName(issue.status)} color={statusColor(issue.status)} />
                          </span>
                        </span>
                        <span className="line-clamp-2 text-[13px] text-ink">{issue.title}</span>
                        <span className="flex w-full items-center gap-2 text-xs text-ink-2">
                          <span suppressHydrationWarning>{formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</span>
                          <span className="ml-auto flex items-center gap-2">
                            {issue.dueDate && (
                              <span className={late ? "font-medium text-danger" : undefined}>
                                {late && <span className="sr-only">Overdue, </span>}
                                {formatCalendarDate(issue.dueDate, "MMM d")}
                              </span>
                            )}
                            {issue.storyPoints !== null && issue.storyPoints !== undefined && <span className="font-mono">{issue.storyPoints} pts</span>}
                            {issue.assignee ? <UserAvatar user={issue.assignee} size="xs" /> : <span>Unassigned</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <div className={cn("min-w-0 flex-1 overflow-y-auto bg-surface", isMobileDetailOpen ? "block" : "hidden md:block")}>
              {selectedIssue ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedIssueId(null)}
                    className="inline-flex items-center gap-1.5 px-4 pt-3 text-xs font-medium text-accent hover:underline md:hidden"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Back to issues list</span>
                  </button>
                  <IssueView
                    issue={selectedIssue}
                    variant="split"
                    project={project}
                    users={users}
                    sprints={sprints}
                    versions={versions}
                    nav={splitNav}
                    onIssueUpdated={handleUpdated}
                    onIssueDeleted={handleDeleted}
                    shortcuts={!panelIssue}
                  />
                </>
              ) : (
                <p className="flex h-full items-center justify-center text-[13px] text-ink-2">Choose an issue to see it here.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-auto bg-surface">
            <IssueTable
              issues={issues}
              columns={columns}
              sort={query.sort}
              onSort={sortBy}
              density={density}
              selectable={canSelect}
              selectedIds={selectedIds}
              onToggle={(id) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onToggleAll={() => setSelectedIds((prev) => (issues.every((i) => prev.has(i.id)) ? new Set() : new Set(issues.map((i) => i.id))))}
              onOpen={setPanelIssue}
              statusColor={statusColor}
              doneStatusNames={doneStatusNames}
            />
            {issues.length === 0 && <p className="p-8 text-center text-[13px] text-ink-2">{isLoading ? "Loading…" : "No issues match these filters."}</p>}
          </div>
        )}
      </div>

      <nav
        aria-label="Pages"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-subtle bg-surface px-3 py-2 text-xs text-ink-2 sm:px-6"
      >
        <span className="flex items-center gap-2">
          {totalCount > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-label="Loading" />}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">Per page</span>
            <Select
              aria-label="Issues per page"
              className="h-7 w-auto min-w-0 text-xs"
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              options={["25", "50", "100"].map((n) => ({ value: n, label: n }))}
            />
          </span>
          <span className="flex items-center gap-0.5">
            <button type="button" onClick={() => setPage(1)} disabled={page <= 1 || isLoading} aria-label="First page" className={pageButton}>
              <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isLoading} aria-label="Previous page" className={pageButton}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="px-1.5 text-ink">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              aria-label="Next page"
              className={pageButton}
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages || isLoading} aria-label="Last page" className={pageButton}>
              <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </span>
      </nav>

      <IssuePanel
        issue={viewMode === "table" ? panelIssue : null}
        issues={issues}
        project={project}
        users={users}
        sprints={sprints}
        versions={versions}
        onClose={() => setPanelIssue(null)}
        onIssueUpdated={(up) => {
          handleUpdated(up);
          setPanelIssue((prev) => (prev?.id === up.id ? up : prev));
        }}
        onIssueDeleted={handleDeleted}
      />

      <Dialog open={labelDialog} onOpenChange={setLabelDialog}>
        <DialogContent
          size="sm"
          title={`Add a label to ${selectedIds.size} ${selectedIds.size === 1 ? "issue" : "issues"}`}
          footer={
            <>
              <Button onClick={() => setLabelDialog(false)}>Cancel</Button>
              <Button type="submit" form="bulk-label-form" variant="primary" disabled={!labelName.trim()}>
                Add label
              </Button>
            </>
          }
        >
          <form
            id="bulk-label-form"
            onSubmit={(e) => {
              e.preventDefault();
              const name = labelName.trim();
              if (!name) return;
              setLabelDialog(false);
              setLabelName("");
              runBulk("add the label", () => bulkAddLabel(ids(), name));
            }}
          >
            <Field label="Label">
              <Input autoFocus value={labelName} onChange={(e) => setLabelName(e.target.value)} list="bulk-label-options" />
            </Field>
            <datalist id="bulk-label-options">
              {labels.map((l) => (
                <option key={l.id} value={l.name} />
              ))}
            </datalist>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent
          size="sm"
          title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? "issue" : "issues"}?`}
          description="Their comments, history and attachments are deleted too. This can't be undone."
          footer={
            <>
              <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteDialog(false);
                  runBulk("delete the issues", () => bulkDeleteIssues(ids()));
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          {null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

