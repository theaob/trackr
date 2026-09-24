"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Project, Issue, User, Sprint, Version, IssueType, PriorityLevel, IssueStatus, WorkflowStatus, Label } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";

import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import IssueView from "@/components/issue/IssueView";
import IssuePanel from "@/components/issue/IssuePanel";
import { useIssueStepper } from "@/components/issue/useIssueStepper";
import {
  getPaginatedIssues,
  bulkUpdateIssues,
  bulkDeleteIssues,
} from "@/lib/actions/issues";
import { bulkAddLabel } from "@/lib/actions/labels";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  Search,
  ArrowUpDown,
  Download,
  X,
  Columns2,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
  CalendarClock,
  Code2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { isOverdue } from "@/lib/dueDate";
import TQLQueryBar from "@/components/issues/tql/TQLQueryBar";
import { TQLAutocompleteContext } from "@/lib/tql/autocomplete";
import { basicFiltersToTQL, tqlToBasicFilters } from "@/lib/tql/converter";
import { TQLParser } from "@/lib/tql/parser";
import { formatCalendarDate } from "@/lib/calendarDate";

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
  initialFilterMode?: "basic" | "tql";
  initialTqlQuery?: string;
}

type FilterPreset =
  | "ALL"
  | "MY_OPEN"
  | "REPORTED_BY_ME"
  | "RECENTLY_UPDATED"
  | "DONE"
  | "HIGH_PRIORITY";

type SortField = "key" | "title" | "status" | "priority" | "storyPoints" | "dueDate" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

export function resolveNextSelectedIssueId(
  prevId: string | null,
  issues: { id: string }[]
): string | null {
  if (!prevId || issues.length === 0) return null;
  if (!issues.some((i) => i.id === prevId)) {
    return null;
  }
  return prevId;
}

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
}: IssuesListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedIssueKey = initialSelectedIssueKey;

  const urlMode = searchParams?.get("mode");
  const urlTql = searchParams?.get("tql");

  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(project);
  const { searchQuery: globalSearchQuery } = useSearch();

  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount ?? initialIssues.length);
  const [page, setPage] = useState<number>(initialPage ?? 1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize ?? 50);
  const [totalPages, setTotalPages] = useState<number>(
    initialTotalPages ?? Math.max(1, Math.ceil((initialTotalCount ?? initialIssues.length) / (initialPageSize ?? 50)))
  );
  const [isLoading, setIsLoading] = useState(false);

  // Sync issues if initialIssues prop updates (e.g. from router.refresh())
  useEffect(() => {
    setIssues(initialIssues);
    setTotalCount(initialTotalCount ?? initialIssues.length);
    setTotalPages(
      initialTotalPages ??
        Math.max(1, Math.ceil((initialTotalCount ?? initialIssues.length) / (initialPageSize ?? 50)))
    );
  }, [initialIssues, initialTotalCount, initialTotalPages, initialPageSize]);

  // Bulk selection, table view only
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLabelInput, setBulkLabelInput] = useState("");
  const [showBulkLabelInput, setShowBulkLabelInput] = useState(false);
  const canSelect = permissions.canEditIssue || permissions.canDeleteIssue;

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    selectedIssueKey
      ? (initialIssues.find(
          (i) =>
            i.key.toUpperCase() === selectedIssueKey.toUpperCase() ||
            i.id === selectedIssueKey
        )?.id ?? null)
      : null
  );
  const isMobileDetailOpen = Boolean(selectedIssueId);

  const handleMobileBackToList = () => setSelectedIssueId(null);
  const [modalIssue, setModalIssue] = useState<Issue | null>(null);

  const handleCloseDetailModal = () => setModalIssue(null);

  // View Mode: Split view or Full Table view
  const [viewMode, setViewMode] = useState<"split" | "table">("split");

  // Filter Mode & TQL State
  const [filterMode, setFilterMode] = useState<"basic" | "tql">(
    urlMode === "tql" || urlTql ? "tql" : initialFilterMode || (initialTqlQuery ? "tql" : "basic")
  );
  const [tqlQuery, setTqlQuery] = useState<string>(urlTql || initialTqlQuery || "");

  // Filter States
  const [projectFilter, setProjectFilter] = useState<string>(project?.id || "ALL");
  const activeProject = (allProjects && allProjects.find((p) => p.id === projectFilter)) || project;
  const isCurrentProjectKanban = activeProject?.boardType === "KANBAN";

  const [preset, setPreset] = useState<FilterPreset>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<IssueType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [reporterFilter, setReporterFilter] = useState<string>("ALL");
  const [sprintFilter, setSprintFilter] = useState<string>("ALL");
  const [versionFilter, setVersionFilter] = useState<string>("ALL");
  const [labelFilter, setLabelFilter] = useState<string>("ALL");

  useEffect(() => {
    if (isCurrentProjectKanban && sprintFilter !== "ALL") {
      setSprintFilter("ALL");
    }
  }, [isCurrentProjectKanban, sprintFilter]);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Sync global search from Navbar
  useEffect(() => {
    if (globalSearchQuery) {
      setSearchQuery(globalSearchQuery);
      setPage(1);
    }
  }, [globalSearchQuery]);

  const autocompleteContext: TQLAutocompleteContext = useMemo(
    () => ({
      projects: (allProjects && allProjects.length > 0 ? allProjects : [project]).map((p) => ({
        key: p.key,
        name: p.name,
      })),
      statuses: statuses.map((s) => s.name),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email || undefined,
      })),
      sprints: sprints.map((s) => s.name),
      versions: versions.map((v) => v.name),
      labels: labels.map((l) => l.name),
    }),
    [allProjects, project, statuses, users, sprints, versions, labels]
  );

  const updateUrlParams = useCallback(
    (newMode: "basic" | "tql", newTql?: string) => {
      if (typeof window === "undefined") return;
      const currentUrl = new URL(window.location.href);
      if (newMode === "tql") {
        currentUrl.searchParams.set("mode", "tql");
        if (newTql && newTql.trim()) {
          currentUrl.searchParams.set("tql", newTql.trim());
        } else {
          currentUrl.searchParams.delete("tql");
        }
      } else {
        currentUrl.searchParams.delete("mode");
        currentUrl.searchParams.delete("tql");
      }
      const newSearch = currentUrl.searchParams.toString();
      router.replace(`${currentUrl.pathname}${newSearch ? `?${newSearch}` : ""}`, { scroll: false });
    },
    [router]
  );

  const handleSwitchToTQL = () => {
    const currentProject =
      allProjects.find((p) => p.id === projectFilter) ||
      (projectFilter !== "ALL" ? project : undefined);
    const currentAssignee = users.find((u) => u.id === assigneeFilter);
    const currentSprint = sprints.find((s) => s.id === sprintFilter);
    const currentVersion = versions.find((v) => v.id === versionFilter);

    const generated = basicFiltersToTQL({
      projectKey: projectFilter !== "ALL" ? currentProject?.key || project?.key : undefined,
      preset: preset !== "ALL" ? preset : undefined,
      type: typeFilter !== "ALL" ? typeFilter : undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      priority: priorityFilter !== "ALL" ? priorityFilter : undefined,
      assigneeId: assigneeFilter,
      assigneeName: currentAssignee?.name,
      reporterId: reporterFilter !== "ALL" ? reporterFilter : undefined,
      sprintId: sprintFilter,
      sprintName: currentSprint?.name,
      versionId: versionFilter,
      versionName: currentVersion?.name,
      label: labelFilter !== "ALL" ? labelFilter : undefined,
      search: searchQuery,
      currentUserId: currentUser?.id,
      sortField,
      sortOrder,
    });

    setTqlQuery(generated);
    setFilterMode("tql");
    setPage(1);
    updateUrlParams("tql", generated);
  };

  const handleSwitchToBasic = () => {
    if (!tqlQuery.trim()) {
      setFilterMode("basic");
      updateUrlParams("basic");
      return;
    }

    const res = tqlToBasicFilters(tqlQuery);
    if (!res.convertible) {
      const confirmSwitch = window.confirm(
        `This query contains advanced TQL features (${res.reason}). Switching to Basic mode will reset those filters. Do you want to continue?`
      );
      if (!confirmSwitch) return;
      handleClearFilters();
      setFilterMode("basic");
      updateUrlParams("basic");
      return;
    }

    const { state } = res;
    if (state.projectKey) {
      const foundProject =
        allProjects.find((p) => p.key.toUpperCase() === state.projectKey!.toUpperCase()) ||
        (project.key.toUpperCase() === state.projectKey!.toUpperCase() ? project : null);
      if (foundProject) {
        setProjectFilter(foundProject.id);
      }
    } else {
      setProjectFilter("ALL");
    }

    setTypeFilter((state.type as IssueType) || "ALL");
    setStatusFilter((state.status as IssueStatus) || "ALL");
    setPriorityFilter((state.priority as PriorityLevel) || "ALL");

    if (state.assigneeId === "UNASSIGNED") {
      setAssigneeFilter("UNASSIGNED");
    } else if (state.assigneeId === "CURRENT_USER" && currentUser) {
      setAssigneeFilter(currentUser.id);
    } else if (state.assigneeId) {
      const foundUser = users.find(
        (u) =>
          u.name.toLowerCase() === state.assigneeId!.toLowerCase() ||
          u.id === state.assigneeId
      );
      setAssigneeFilter(foundUser ? foundUser.id : "ALL");
    } else {
      setAssigneeFilter("ALL");
    }

    if (state.sprintId === "BACKLOG") {
      setSprintFilter("BACKLOG");
    } else if (state.sprintId) {
      const foundSprint = sprints.find(
        (s) =>
          s.name.toLowerCase() === state.sprintId!.toLowerCase() ||
          s.id === state.sprintId
      );
      setSprintFilter(foundSprint ? foundSprint.id : "ALL");
    } else {
      setSprintFilter("ALL");
    }

    if (state.versionId === "UNASSIGNED") {
      setVersionFilter("UNASSIGNED");
    } else if (state.versionId) {
      const foundVersion = versions.find(
        (v) =>
          v.name.toLowerCase() === state.versionId!.toLowerCase() ||
          v.id === state.versionId
      );
      setVersionFilter(foundVersion ? foundVersion.id : "ALL");
    } else {
      setVersionFilter("ALL");
    }

    setLabelFilter(state.label || "ALL");
    setSearchQuery(state.search || "");
    if (state.sortField) {
      setSortField(state.sortField as SortField);
    }
    if (state.sortOrder) {
      setSortOrder(state.sortOrder);
    }

    setPreset("ALL");
    setFilterMode("basic");
    setPage(1);
    updateUrlParams("basic");
  };

  // Server-side fetch on filter/pagination/sorting changes
  // A background refresh keeps the row selection and skips the spinner.
  const fetchIssues = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (filterMode === "tql" && tqlQuery.trim()) {
      const syntaxCheck = TQLParser.parse(tqlQuery);
      if (!syntaxCheck.success) {
        return;
      }
    }

    if (!background) setIsLoading(true);
    try {
      const res = await getPaginatedIssues(
        filterMode === "tql"
          ? {
              projectId: projectFilter,
              page,
              pageSize,
              tql: tqlQuery,
              currentUserId: currentUser?.id,
            }
          : {
              projectId: projectFilter,
              page,
              pageSize,
              search: searchQuery,
              preset,
              currentUserId: currentUser?.id,
              type: typeFilter,
              status: statusFilter,
              priority: priorityFilter,
              assigneeId: assigneeFilter,
              reporterId: reporterFilter,
              sprintId: sprintFilter,
              versionId: versionFilter,
              label: labelFilter,
              sortField,
              sortOrder,
            }
      );
      setIssues(res.issues as any);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
      if (background) {
        const stillListed = new Set(res.issues.map((i) => i.id));
        setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => stillListed.has(id))));
      } else {
        setSelectedIds(new Set());
      }
      setSelectedIssueId((prevId) => resolveNextSelectedIssueId(prevId, res.issues));
    } catch (err) {
      console.error("Failed to load paginated issues", err);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [
    filterMode,
    tqlQuery,
    projectFilter,
    page,
    pageSize,
    searchQuery,
    preset,
    typeFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    reporterFilter,
    sprintFilter,
    versionFilter,
    labelFilter,
    sortField,
    sortOrder,
    currentUser?.id,
  ]);

  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(() => {
      if (!isCancelled) {
        fetchIssues();
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [fetchIssues]);

  // Pick up issues changed in another tab or by someone else.
  useRefetchOnFocus(() => fetchIssues({ background: true }));

  // Handle jira:issue-created custom event
  useEffect(() => {
    const handleIssueCreatedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ issue?: Issue }>;
      const newIssue = customEvent.detail?.issue;
      if (!newIssue) return;

      const matchesProject =
        projectFilter === "ALL" || newIssue.projectId === projectFilter;

      if (matchesProject) {
        setIssues((prev) => {
          if (prev.some((i) => i.id === newIssue.id)) return prev;
          return [newIssue, ...prev];
        });
        setTotalCount((prev) => prev + 1);
        if (page !== 1) {
          setPage(1);
        }
      }
    };

    window.addEventListener("trackr:issue-created", handleIssueCreatedEvent);
    return () => {
      window.removeEventListener("trackr:issue-created", handleIssueCreatedEvent);
    };
  }, [projectFilter, page]);

  // Reset Filters
  const handleClearFilters = () => {
    if (filterMode === "tql") {
      setTqlQuery("");
      updateUrlParams("tql", "");
    }
    setPreset("ALL");
    setSearchQuery("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setAssigneeFilter("ALL");
    setReporterFilter("ALL");
    setSprintFilter("ALL");
    setVersionFilter("ALL");
    setLabelFilter("ALL");
    setPage(1);
  };

  // Bulk selection helpers (table view)
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const allSelected = filteredAndSortedIssues.every((i) => prev.has(i.id));
      if (allSelected) return new Set();
      return new Set(filteredAndSortedIssues.map((i) => i.id));
    });
  };

  const runBulkAction = async (
    action: () => Promise<
      | { success: true; succeeded: number; failed: { id: string; error: string }[] }
      | { success: false; error: string }
    >
  ) => {
    setIsBulkActing(true);
    setBulkError(null);
    const res = await action();
    setIsBulkActing(false);
    if (!res.success) {
      setBulkError(res.error);
      return;
    }
    if (res.failed.length > 0) {
      setBulkError(
        `${res.succeeded} of ${res.succeeded + res.failed.length} issues updated. ${res.failed.length} failed: ${res.failed[0].error}`
      );
    }
    await fetchIssues();
  };

  const handleBulkStatusChange = (status: string) =>
    runBulkAction(() => bulkUpdateIssues(Array.from(selectedIds), { status: status as IssueStatus }));

  const handleBulkAssigneeChange = (assigneeId: string) =>
    runBulkAction(() => bulkUpdateIssues(Array.from(selectedIds), { assigneeId: assigneeId || null }));

  const handleBulkPriorityChange = (priority: string) =>
    runBulkAction(() => bulkUpdateIssues(Array.from(selectedIds), { priority: priority as PriorityLevel }));

  const handleBulkVersionChange = (versionId: string) =>
    runBulkAction(() =>
      bulkUpdateIssues(Array.from(selectedIds), {
        versionId: versionId === "NONE" ? null : versionId,
      })
    );

  const handleBulkAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const name = bulkLabelInput.trim();
    if (!name) return;
    runBulkAction(() => bulkAddLabel(Array.from(selectedIds), name));
    setBulkLabelInput("");
    setShowBulkLabelInput(false);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.size} issue${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    runBulkAction(() => bulkDeleteIssues(Array.from(selectedIds)));
  };

  const hasActiveFilters =
    filterMode === "tql"
      ? tqlQuery.trim() !== ""
      : preset !== "ALL" ||
        searchQuery.trim() !== "" ||
        typeFilter !== "ALL" ||
        statusFilter !== "ALL" ||
        priorityFilter !== "ALL" ||
        assigneeFilter !== "ALL" ||
        reporterFilter !== "ALL" ||
        sprintFilter !== "ALL" ||
        versionFilter !== "ALL" ||
        labelFilter !== "ALL";

  // Issues displayed on current page
  const filteredAndSortedIssues = issues;

  const doneStatusNames = useMemo(
    () => statuses.filter((s) => s.category === "DONE").map((s) => s.name),
    [statuses]
  );

  // Selected Issue for Split View
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return issues[0] || null;
    return (
      issues.find((i) => i.id === selectedIssueId) ||
      issues[0] ||
      null
    );
  }, [selectedIssueId, issues]);

  const handleSplitIssueUpdated = useCallback((updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);
  const handleIssueDeleted = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
    setSelectedIssueId((prev) => (prev === id ? null : prev));
    setModalIssue((prev) => (prev?.id === id ? null : prev));
  }, []);
  const splitNav = useIssueStepper(selectedIssue, issues, (next) => setSelectedIssueId(next.id));

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Key",
      "Type",
      "Title",
      "Status",
      "Priority",
      "StoryPoints",
      "Assignee",
      "Reporter",
      "Created",
    ];
    const rows = filteredAndSortedIssues.map((i) => [
      i.key,
      i.type,
      `"${i.title.replace(/"/g, '""')}"`,
      i.status,
      i.priority,
      i.storyPoints ?? "",
      i.assignee?.name || "Unassigned",
      i.reporter?.name || "Anonymous",
      format(new Date(i.createdAt), "yyyy-MM-dd"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${project.key}-issues-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Top Header & Preset Bar */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-5 pb-2.5 sm:pb-3 border-b border-jira-gray-200 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-jira-navy tracking-tight">Issues</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-jira-gray-200 text-jira-gray-700">
              {totalCount.toLocaleString()} issues
            </span>
          </div>

          {/* Right Tools: View Mode Toggle & CSV Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="text-xs font-medium text-jira-navy bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 px-2.5 sm:px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <div className="flex items-center border border-jira-gray-300 rounded overflow-hidden">
              <button
                onClick={() => setViewMode("split")}
                className={`p-1.5 transition-colors ${
                  viewMode === "split"
                    ? "bg-jira-blue-light text-jira-blue font-bold"
                    : "bg-white text-jira-gray-600 hover:bg-jira-gray-100"
                }`}
                title="Split View (List + Details)"
              >
                <Columns2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 transition-colors ${
                  viewMode === "table"
                    ? "bg-jira-blue-light text-jira-blue font-bold"
                    : "bg-white text-jira-gray-600 hover:bg-jira-gray-100"
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {filterMode === "tql" ? (
          <div className="pt-0.5">
            <TQLQueryBar
              query={tqlQuery}
              onChange={(q) => {
                setTqlQuery(q);
                setPage(1);
              }}
              onSearch={() => {
                fetchIssues();
                updateUrlParams("tql", tqlQuery);
              }}
              onSwitchToBasic={handleSwitchToBasic}
              isLoading={isLoading}
              context={autocompleteContext}
            />
          </div>
        ) : (
          <>
            {/* Preset Tabs & Mode Switcher */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs whitespace-nowrap">
                {[
                  { id: "ALL", label: "All Issues" },
                  { id: "MY_OPEN", label: "My Open Issues" },
                  { id: "REPORTED_BY_ME", label: "Reported by Me" },
                  { id: "RECENTLY_UPDATED", label: "Recently Updated" },
                  { id: "HIGH_PRIORITY", label: "High Priority" },
                  { id: "DONE", label: "Done" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setPreset(tab.id as FilterPreset);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                      preset === tab.id
                        ? "bg-jira-blue text-white font-semibold"
                        : "text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TQL mode toggle */}
              <button
                type="button"
                onClick={handleSwitchToTQL}
                className="text-xs font-semibold px-2.5 py-1 rounded border border-jira-gray-300 text-jira-gray-700 hover:bg-jira-gray-100 hover:text-jira-navy flex items-center gap-1.5 transition-colors shrink-0"
                title="Switch to the TQL query bar"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>TQL</span>
              </button>
            </div>

        {/* Advanced Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Keyword Search & Search/Refresh Button */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-gray-500" />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    fetchIssues();
                  }
                }}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchIssues()}
              disabled={isLoading}
              className="text-xs bg-jira-blue hover:bg-jira-blue-hover text-white font-semibold px-3 py-1 rounded flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-60 shrink-0 cursor-pointer"
              title="Search and manually refresh results"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Search</span>
            </button>
          </div>

          {/* Project Filter */}
          {allProjects && allProjects.length > 1 && (
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-semibold focus:border-jira-blue"
            >
              <option value="ALL">All Projects</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          )}

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as IssueType | "ALL");
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
          >
            <option value="ALL">Type: All</option>
            <option value="STORY">Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="EPIC">Epic</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as IssueStatus | "ALL");
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
          >
            <option value="ALL">Status: All</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.name}>
                {prettifyStatusName(s.name)}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <div className="relative inline-flex items-center">
            {priorityFilter !== "ALL" && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <PriorityIcon priority={priorityFilter} className="w-3.5 h-3.5" />
              </div>
            )}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as PriorityLevel | "ALL");
                setPage(1);
              }}
              className={`text-xs bg-white border border-jira-gray-300 rounded pr-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue ${
                priorityFilter !== "ALL" ? "pl-7" : "px-2.5"
              }`}
            >
              <option value="ALL">Priority: All</option>
              <option value="HIGHEST">Highest</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="LOWEST">Lowest</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
          >
            <option value="ALL">Assignee: All</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Sprint Filter (Hidden for Kanban projects) */}
          {!isCurrentProjectKanban && (
            <select
              value={sprintFilter}
              onChange={(e) => {
                setSprintFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
            >
              <option value="ALL">Sprint: All</option>
              <option value="BACKLOG">Backlog (No Sprint)</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Version Filter */}
          {versions.length > 0 && (
            <select
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
            >
              <option value="ALL">Version: All</option>
              <option value="UNASSIGNED">Unassigned</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.status})
                </option>
              ))}
            </select>
          )}

          {/* Label Filter */}
          {labels.length > 0 && (
            <select
              value={labelFilter}
              onChange={(e) => {
                setLabelFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium focus:border-jira-blue"
            >
              <option value="ALL">Label: All</option>
              {labels.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort Field & Order */}
          <div className="flex items-center gap-1 border-l border-jira-gray-300 pl-2 ml-1">
            <span className="text-[11px] text-jira-gray-500">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as SortField);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="priority">Priority</option>
              <option value="key">Key</option>
              <option value="status">Status</option>
              <option value="storyPoints">Story Points</option>
              <option value="dueDate">Due Date</option>
            </select>
            <button
              onClick={() => {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                setPage(1);
              }}
              className="p-1 bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 rounded text-jira-gray-700"
              title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fetchIssues()}
              disabled={isLoading}
              className="p-1 bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 rounded text-jira-gray-700 transition-colors disabled:opacity-60"
              title="Manually refresh results"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-jira-blue" : ""}`} />
            </button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-jira-blue hover:text-jira-blue-hover font-semibold flex items-center gap-1 ml-auto transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </>
    )}
  </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {viewMode === "split" ? (
          /* SPLIT VIEW: Left List + Right Details */
          <div className="flex-1 flex overflow-hidden min-w-0">
            {/* Left Issue List */}
            <div
              className={`w-full md:w-80 lg:w-96 border-r border-jira-gray-300 overflow-y-auto divide-y divide-jira-gray-200 shrink-0 bg-white ${
                isMobileDetailOpen ? "hidden md:block" : "block"
              }`}
            >
              {filteredAndSortedIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-jira-gray-500">
                  No issues found matching your filters.
                </div>
              ) : (
                filteredAndSortedIssues.map((issue) => {
                  const isSelected = selectedIssueId ? issue.id === selectedIssueId : selectedIssue?.id === issue.id;
                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className={`p-3.5 cursor-pointer transition-colors border-l-4 ${
                        isSelected
                          ? "bg-jira-blue-subtle/50 border-jira-blue"
                          : "border-transparent hover:bg-jira-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <IssueTypeBadge type={issue.type} size="xs" />
                          <span className="text-xs font-bold text-jira-gray-600">{issue.key}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
                          <StatusBadge status={issue.status} />
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-jira-navy line-clamp-2 leading-snug">
                        {issue.title}
                      </h4>

                      {issue.labels && issue.labels.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {issue.labels.map((il) => (
                            <span
                              key={il.id}
                              className="inline-flex px-1.5 py-0.5 rounded-full bg-jira-gray-100 border border-jira-gray-300 text-[10px] font-medium text-jira-gray-700"
                            >
                              {il.label.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-jira-gray-500">
                        <span>
                          {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                        </span>
                        <div className="flex items-center gap-2">
                          {issue.dueDate && (
                            <span
                              className={`flex items-center gap-1 text-[10px] font-medium ${
                                isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                   ? "text-rose-600 font-bold"
                                   : "text-jira-gray-600"
                              }`}
                            >
                              <CalendarClock className="w-3 h-3" />
                              {formatCalendarDate(issue.dueDate, "MMM d")}
                            </span>
                          )}
                          {issue.storyPoints !== null && (
                            <span className="px-1.5 py-px rounded-full bg-jira-gray-200 text-jira-gray-700 font-bold text-[10px]">
                              {issue.storyPoints} pts
                            </span>
                          )}
                          {issue.assignee ? (
                            <UserAvatar
                              user={issue.assignee}
                              size="xs"
                              showTooltip
                              tooltipPrefix="Assignee"
                            />
                          ) : (
                            <span className="text-jira-gray-400">Unassigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Issue Detail Panel */}
            <div
              className={`flex-1 min-w-0 overflow-y-auto bg-surface ${
                isMobileDetailOpen ? "block" : "hidden md:block"
              }`}
            >
              {selectedIssue ? (
                <>
                  <button
                    type="button"
                    onClick={handleMobileBackToList}
                    className="md:hidden inline-flex items-center gap-1.5 px-4 pt-3 text-xs font-medium text-accent hover:underline"
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
                    onIssueUpdated={handleSplitIssueUpdated}
                    onIssueDeleted={handleIssueDeleted}
                    shortcuts={!modalIssue}
                  />
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-jira-gray-500">
                  Select an issue to inspect details
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="flex-1 overflow-auto p-3 sm:p-6">
            {canSelect && selectedIds.size > 0 && (
              <div className="mb-3 p-2.5 bg-jira-blue-light/40 border border-jira-blue/30 rounded-lg flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-jira-navy pr-1">
                  {selectedIds.size} selected
                </span>

                {permissions.canEditIssue && (
                  <>
                    <select
                      disabled={isBulkActing}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleBulkStatusChange(e.target.value);
                        e.target.value = "";
                      }}
                      className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy disabled:opacity-60"
                    >
                      <option value="" disabled>
                        Set status...
                      </option>
                      {statuses.map((s) => (
                        <option key={s.id} value={s.name}>
                          {prettifyStatusName(s.name)}
                        </option>
                      ))}
                    </select>

                    <select
                      disabled={isBulkActing}
                      defaultValue=""
                      onChange={(e) => {
                        handleBulkAssigneeChange(e.target.value);
                        e.target.value = "";
                      }}
                      className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy disabled:opacity-60"
                    >
                      <option value="" disabled>
                        Set assignee...
                      </option>
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>

                    <select
                      disabled={isBulkActing}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleBulkPriorityChange(e.target.value);
                        e.target.value = "";
                      }}
                      className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy disabled:opacity-60"
                    >
                      <option value="" disabled>
                        Set priority...
                      </option>
                      <option value="HIGHEST">Highest</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="LOWEST">Lowest</option>
                    </select>

                    {versions.length > 0 && (
                      <select
                        disabled={isBulkActing}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleBulkVersionChange(e.target.value);
                          e.target.value = "";
                        }}
                        className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy disabled:opacity-60"
                      >
                        <option value="" disabled>
                          Set fix version...
                        </option>
                        <option value="NONE">None (Unassigned)</option>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {showBulkLabelInput ? (
                      <form onSubmit={handleBulkAddLabel} className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={bulkLabelInput}
                          disabled={isBulkActing}
                          onChange={(e) => setBulkLabelInput(e.target.value)}
                          onBlur={() => {
                            if (!bulkLabelInput.trim()) setShowBulkLabelInput(false);
                          }}
                          placeholder="Label name..."
                          className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy w-32"
                        />
                        <button
                          type="submit"
                          disabled={isBulkActing || !bulkLabelInput.trim()}
                          className="px-2 py-1 bg-jira-blue text-white rounded font-semibold disabled:opacity-50"
                        >
                          Add
                        </button>
                      </form>
                    ) : (
                      <button
                        disabled={isBulkActing}
                        onClick={() => setShowBulkLabelInput(true)}
                        className="px-2 py-1 bg-white border border-jira-gray-300 rounded text-jira-navy font-medium hover:bg-jira-gray-50 disabled:opacity-60"
                      >
                        Add label
                      </button>
                    )}
                  </>
                )}

                {permissions.canDeleteIssue && (
                  <button
                    disabled={isBulkActing}
                    onClick={handleBulkDelete}
                    className="px-2 py-1 bg-white border border-rose-300 text-rose-600 rounded font-semibold hover:bg-rose-50 disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}

                {isBulkActing && <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-blue" />}

                <button
                  disabled={isBulkActing}
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-jira-gray-600 hover:text-jira-navy font-medium disabled:opacity-60"
                >
                  Clear selection
                </button>
              </div>
            )}

            {bulkError && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center justify-between gap-2">
                <span>{bulkError}</span>
                <button onClick={() => setBulkError(null)} className="shrink-0 hover:text-rose-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="border border-jira-gray-300 rounded-lg overflow-x-auto shadow-xs bg-white">
              <table className="w-full text-left text-xs text-jira-navy">
                <thead className="bg-jira-gray-100 text-jira-gray-700 font-bold uppercase tracking-wider border-b border-jira-gray-300">
                  <tr>
                    {canSelect && (
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            filteredAndSortedIssues.length > 0 &&
                            filteredAndSortedIssues.every((i) => selectedIds.has(i.id))
                          }
                          onChange={toggleSelectAllOnPage}
                          className="cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Key</th>
                    <th className="py-2.5 px-3">Summary</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Points</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Due</th>
                    <th className="py-2.5 px-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jira-gray-200">
                  {filteredAndSortedIssues.length === 0 ? (
                    <tr>
                      <td colSpan={canSelect ? 10 : 9} className="py-8 text-center text-jira-gray-500">
                        No issues found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedIssues.map((issue) => (
                      <tr
                        key={issue.id}
                        onClick={() => setModalIssue(issue)}
                        className={`hover:bg-jira-gray-50 cursor-pointer transition-colors ${
                          selectedIds.has(issue.id) ? "bg-jira-blue-subtle/30" : ""
                        }`}
                      >
                        {canSelect && (
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(issue.id)}
                              onChange={() => toggleSelectOne(issue.id)}
                              className="cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-2 px-3">
                          <IssueTypeBadge type={issue.type} size="xs" />
                        </td>
                        <td className="py-2 px-3 font-bold text-jira-blue">{issue.key}</td>
                        <td className="py-2 px-3 font-medium max-w-md">
                          <div className="truncate">{issue.title}</div>
                          {issue.labels && issue.labels.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {issue.labels.map((il) => (
                                <span
                                  key={il.id}
                                  className="inline-flex px-1.5 py-0.5 rounded-full bg-jira-gray-100 border border-jira-gray-300 text-[10px] font-medium text-jira-gray-700"
                                >
                                  {il.label.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={issue.status} />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
                            <span className="capitalize">{issue.priority.toLowerCase()}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {issue.storyPoints !== null ? issue.storyPoints : "-"}
                        </td>
                        <td className="py-2 px-3">
                          {issue.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <UserAvatar user={issue.assignee} size="xs" />
                              <span>{issue.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-jira-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {issue.dueDate ? (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                  ? "text-rose-600 font-semibold"
                                  : "text-jira-gray-600"
                              }`}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              {formatCalendarDate(issue.dueDate, "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-jira-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-jira-gray-500">
                          {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      <div className="px-3 sm:px-6 py-2.5 bg-jira-gray-50 border-t border-jira-gray-300 shrink-0 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs text-jira-gray-700">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-jira-navy font-semibold">{totalCount > 0 ? (page - 1) * pageSize + 1 : 0}</strong>–<strong className="text-jira-navy font-semibold">{Math.min(page * pageSize, totalCount)}</strong> of <strong className="text-jira-navy font-semibold">{totalCount.toLocaleString()}</strong> issues
          </span>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-jira-blue text-xs font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading...
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-jira-gray-600">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-jira-blue"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              className="p-1 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 font-medium text-jira-navy">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              className="p-1 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Jump to Page */}
          {totalPages > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-jira-gray-300">
              <span className="text-jira-gray-600">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                defaultValue={page}
                key={page}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setPage(val);
                    }
                  }
                }}
                className="w-14 bg-white border border-jira-gray-300 rounded px-1.5 py-1 text-xs text-center focus:ring-1 focus:ring-jira-blue"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table view: a row opens the issue in a panel */}
      <IssuePanel
        issue={viewMode === "table" ? modalIssue : null}
        issues={issues}
        project={project}
        users={users}
        sprints={sprints}
        versions={versions}
        onClose={handleCloseDetailModal}
        onIssueUpdated={(up) => {
          setIssues((prev) => prev.map((i) => (i.id === up.id ? up : i)));
          setModalIssue((prev) => (prev?.id === up.id ? up : prev));
        }}
        onIssueDeleted={handleIssueDeleted}
      />
    </div>
  );
}
