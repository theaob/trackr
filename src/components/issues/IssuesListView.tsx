"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Project, Issue, User, Sprint, Version, IssueType, PriorityLevel, IssueStatus, WorkflowStatus, Label, Comment } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";

import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import IssueDetailModal from "./IssueDetailModal";
import ChildIssuesSection from "@/components/issues/ChildIssuesSection";
import IssueLinksSection from "@/components/issues/IssueLinksSection";
import IssueDescriptionEditor from "@/components/issues/IssueDescriptionEditor";
import MentionInput from "@/components/common/MentionInput";
import MarkdownContent from "@/components/common/MarkdownContent";
import {
  updateIssue,
  deleteIssue,
  getPaginatedIssues,
  getIssueByKeyOrId,
  getOlderIssueHistory,
  bulkUpdateIssues,
  bulkDeleteIssues,
} from "@/lib/actions/issues";
import {
  HistoryKind,
  historyRemaining,
  historyTotal,
  oldestLoadedId,
  withCommentCountChange,
  withOlderHistory,
} from "@/lib/issueHistory";
import ShowOlderButton from "@/components/issues/ShowOlderButton";
import { bulkAddLabel } from "@/lib/actions/labels";
import { addComment, deleteComment } from "@/lib/actions/comments";
import { uploadAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_SIZE, formatFileSize, generatePastedImageFileName } from "@/lib/attachments";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  X,
  LayoutGrid,
  Columns2,
  Table as TableIcon,
  Trash2,
  Calendar,
  MessageSquare,
  History,
  Filter,
  Check,
  ChevronDown,
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
  const selectedIssueKey =
    searchParams?.get("selectedIssue") || searchParams?.get("issue") || initialSelectedIssueKey;

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

  const handleMobileBackToList = () => {
    setSelectedIssueId(null);
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (
        currentUrl.searchParams.has("selectedIssue") ||
        currentUrl.searchParams.has("issue")
      ) {
        currentUrl.searchParams.delete("selectedIssue");
        currentUrl.searchParams.delete("issue");
        const newSearch = currentUrl.searchParams.toString();
        router.replace(`${currentUrl.pathname}${newSearch ? `?${newSearch}` : ""}`, { scroll: false });
      }
    }
  };
  const [modalIssue, setModalIssue] = useState<Issue | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  // Handle selectedIssue query parameter
  useEffect(() => {
    if (!selectedIssueKey) return;
    const found = issues.find(
      (i) =>
        i.key.toUpperCase() === selectedIssueKey.toUpperCase() ||
        i.id === selectedIssueKey
    );
    if (found) {
      setSelectedIssueId(found.id);
    } else {
      getIssueByKeyOrId(selectedIssueKey).then((fetched) => {
        if (fetched) {
          const typed = fetched as unknown as Issue;
          setIssues((prev) => [typed, ...prev.filter((i) => i.id !== typed.id)]);
          setSelectedIssueId(typed.id);
        }
      });
    }
  }, [selectedIssueKey, issues]);

  // Handle jira:open-issue custom event
  useEffect(() => {
    const handleOpenIssueEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ issueKey?: string }>;
      const targetKey = customEvent.detail?.issueKey;
      if (!targetKey) return;
      const found = issues.find(
        (i) =>
          i.key.toUpperCase() === targetKey.toUpperCase() ||
          i.id === targetKey
      );
      if (found) {
        setSelectedIssueId(found.id);
      } else {
        getIssueByKeyOrId(targetKey).then((fetched) => {
          if (fetched) {
            const typed = fetched as unknown as Issue;
            setIssues((prev) => [typed, ...prev.filter((i) => i.id !== typed.id)]);
            setSelectedIssueId(typed.id);
          }
        });
      }
    };

    window.addEventListener("trackr:open-issue", handleOpenIssueEvent);
    return () => {
      window.removeEventListener("trackr:open-issue", handleOpenIssueEvent);
    };
  }, [issues]);



  const handleCloseDetailModal = () => {
    setModalIssue(null);
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (
        currentUrl.searchParams.has("selectedIssue") ||
        currentUrl.searchParams.has("issue")
      ) {
        currentUrl.searchParams.delete("selectedIssue");
        currentUrl.searchParams.delete("issue");
        const newSearch = currentUrl.searchParams.toString();
        router.replace(`${currentUrl.pathname}${newSearch ? `?${newSearch}` : ""}`);
      }
    }
  };

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

  // Right Panel Editing State (for split view)
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

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

  // The list query does not carry comment and activity threads -- loading them
  // for every row costs far more than the table ever shows. Fetch the full
  // record for the one issue on display instead.
  // Keyed on whether details are missing, not just the id: a list reload swaps
  // in the slim record again and the details have to be fetched again.
  const selectedId = selectedIssue?.id;
  const selectedNeedsDetails =
    !!selectedIssue && !(selectedIssue.comments && selectedIssue.children && selectedIssue.linksAsSource);
  useEffect(() => {
    if (!selectedId || !selectedNeedsDetails) return;

    let cancelled = false;

    getIssueByKeyOrId(selectedId).then((fetched) => {
      if (cancelled || !fetched) return;
      const typed = fetched as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === typed.id ? typed : i)));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedNeedsDetails]);

  const [loadingOlder, setLoadingOlder] = useState<HistoryKind | null>(null);
  const loadOlderHistory = async (kind: HistoryKind) => {
    if (!selectedIssue) return;
    const beforeId = oldestLoadedId(selectedIssue, kind);
    if (!beforeId) return;
    const targetId = selectedIssue.id;
    setLoadingOlder(kind);
    const older = await getOlderIssueHistory(targetId, kind, beforeId);
    setLoadingOlder(null);
    setIssues((prev) => prev.map((i) => (i.id === targetId ? withOlderHistory(i, kind, older) : i)));
  };

  // Sync description draft when selected issue changes
  useEffect(() => {
    setDescriptionDraft(selectedIssue?.description || "");
  }, [selectedIssue?.id, selectedIssue?.description]);

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

  // Issue update handler with optimistic update and rollback
  const handleUpdateCurrentIssue = async (data: Partial<Issue>) => {
    if (!selectedIssue) return;
    const previousIssues = issues;
    const optimisticIssue = { ...selectedIssue, ...data };
    setIssues((prev) => prev.map((i) => (i.id === selectedIssue.id ? (optimisticIssue as Issue) : i)));

    const res = await updateIssue(selectedIssue.id, {
      ...data,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const updated = res.issue as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? { ...optimisticIssue, ...updated } : i)));
    } else {
      setIssues(previousIssues);
      if (res.error) alert(res.error);
    }
  };

  // Add Comment in Split View with optimistic insertion and rollback
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || !selectedIssue) return;

    const commentText = newComment.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      content: commentText,
      issueId: selectedIssue.id,
      authorId: currentUser.id,
      author: currentUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const previousIssues = issues;
    const updatedComments = [optimisticComment, ...(selectedIssue.comments || [])];
    const optimisticSelected = withCommentCountChange({ ...selectedIssue, comments: updatedComments }, 1);

    setIssues((prev) => prev.map((i) => (i.id === selectedIssue.id ? optimisticSelected : i)));
    setNewComment("");

    const res = await addComment(selectedIssue.id, currentUser.id, commentText);
    if (res.success && res.comment) {
      const finalComments = (optimisticSelected.comments || []).map((c) =>
        c.id === tempId ? (res.comment as unknown as Comment) : c
      );
      const finalSelected = { ...optimisticSelected, comments: finalComments };
      setIssues((prev) => prev.map((i) => (i.id === selectedIssue.id ? finalSelected : i)));
    } else {
      setIssues(previousIssues);
      setNewComment(commentText);
      alert(res.error || "Failed to post comment.");
    }
  };

  const handleSplitViewImagePaste = async (file: File) => {
    if (!selectedIssue) return { success: false, error: "No issue selected" };
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return {
        success: false,
        error: `Image too large. Maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`,
      };
    }
    const fileName =
      !file.name || file.name === "image.png" || file.name === "blob"
        ? generatePastedImageFileName(file.type || "image/png")
        : file.name;
    const renamedFile = new File([file], fileName, { type: file.type || "image/png" });
    const formData = new FormData();
    formData.append("file", renamedFile);
    const res = await uploadAttachment(selectedIssue.id, formData);
    if (res.success && res.attachment) {
      return {
        success: true,
        url: `/api/v1/attachments/${res.attachment.id}`,
        fileName: res.attachment.fileName,
      };
    }
    return {
      success: false,
      error: (res as { error?: string }).error || "Failed to upload image",
    };
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
              className={`flex-1 min-w-0 overflow-y-auto bg-white p-3.5 sm:p-6 ${
                isMobileDetailOpen ? "block" : "hidden md:block"
              }`}
            >
              {selectedIssue ? (
                <div className="max-w-4xl space-y-6 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={handleMobileBackToList}
                    className="md:hidden inline-flex items-center gap-1.5 text-xs text-jira-blue font-semibold hover:underline py-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to issues list</span>
                  </button>

                  {/* Issue Key & Status Ribbon */}
                  <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200">
                    <div className="flex items-center gap-2">
                      <IssueTypeBadge type={selectedIssue.type} size="sm" showLabel />
                      <span className="text-sm font-bold text-jira-gray-700">{selectedIssue.key}</span>
                      {selectedIssue.parent && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIssueId(selectedIssue.parent!.id);
                            getIssueByKeyOrId(selectedIssue.parent!.id).then((fetched) => {
                              if (fetched) {
                                setIssues((prev) => {
                                  const exists = prev.some((i) => i.id === fetched.id);
                                  return exists ? prev : [fetched as unknown as Issue, ...prev];
                                });
                              }
                            });
                          }}
                          className="text-xs font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 px-2 py-0.5 rounded transition-colors text-left"
                          title={`Parent Epic: ${selectedIssue.parent.title} (${selectedIssue.parent.key})`}
                        >
                          {selectedIssue.parent.title}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      {issues.length > 1 && (
                        <div className="flex items-center gap-1 border-r border-jira-gray-200 pr-2 text-xs text-jira-gray-500">
                          <span className="hidden sm:inline text-[11px] font-medium text-jira-gray-500 mr-1 select-none">
                            {issues.findIndex((i) => i.id === selectedIssue.id) + 1} of {issues.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const idx = issues.findIndex((i) => i.id === selectedIssue.id);
                              if (idx > 0) setSelectedIssueId(issues[idx - 1].id);
                            }}
                            disabled={issues.findIndex((i) => i.id === selectedIssue.id) <= 0}
                            className="p-1 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            title="Previous issue"
                            aria-label="Previous issue"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const idx = issues.findIndex((i) => i.id === selectedIssue.id);
                              if (idx >= 0 && idx < issues.length - 1) setSelectedIssueId(issues[idx + 1].id);
                            }}
                            disabled={
                              issues.findIndex((i) => i.id === selectedIssue.id) === -1 ||
                              issues.findIndex((i) => i.id === selectedIssue.id) >= issues.length - 1
                            }
                            className="p-1 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            title="Next issue"
                            aria-label="Next issue"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <select
                        value={selectedIssue.status}
                        disabled={!permissions.canEditIssue}
                        onChange={(e) =>
                          handleUpdateCurrentIssue({ status: e.target.value as IssueStatus })
                        }
                        className={`bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-xs font-bold text-jira-navy focus:border-jira-blue ${
                          !permissions.canEditIssue ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        title={!permissions.canEditIssue ? "You do not have permission to edit issues" : undefined}
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.name}>
                            {prettifyStatusName(s.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-jira-navy leading-snug">
                      {selectedIssue.title}
                    </h2>
                    {selectedIssue.labels && selectedIssue.labels.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {selectedIssue.labels.map((il) => (
                          <span
                            key={il.id}
                            className="inline-flex px-2 py-0.5 rounded-full bg-jira-gray-100 border border-jira-gray-300 text-[11px] font-medium text-jira-gray-700"
                          >
                            {il.label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Two Column Layout for Issue Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
                    {/* Main Details (2 cols) */}
                    <div className="lg:col-span-2 space-y-6 min-w-0">
                      {/* Description */}
                      <IssueDescriptionEditor
                        value={descriptionDraft}
                        onChange={setDescriptionDraft}
                        users={users}
                        mode="click-to-edit"
                        canEdit={permissions.canEditIssue}
                        onSave={() => handleUpdateCurrentIssue({ description: descriptionDraft })}
                        onCancel={() => setDescriptionDraft(selectedIssue.description || "")}
                        onImagePaste={handleSplitViewImagePaste}
                        placeholder="Add a description..."
                        minRows={4}
                      />

                      {/* Child / Epic Issues Section */}
                      <div className="pt-2 border-t border-jira-gray-200 min-w-0">
                        <ChildIssuesSection
                          parentIssue={selectedIssue}
                          childIssues={selectedIssue.children as any}
                          canEdit={permissions.canEditIssue}
                          workflowStatuses={statuses}
                          onChildAdded={(newChild) => {
                            const updatedChildren = [...(selectedIssue.children || []), newChild];
                            const updated = { ...selectedIssue, children: updatedChildren };
                            setIssues((prev) =>
                              prev.map((i) => (i.id === selectedIssue.id ? updated : i))
                            );
                          }}
                          onChildRemoved={(childId) => {
                            const updatedChildren = (selectedIssue.children || []).filter(
                              (c: any) => c.id !== childId
                            );
                            const updated = { ...selectedIssue, children: updatedChildren };
                            setIssues((prev) =>
                              prev.map((i) => (i.id === selectedIssue.id ? updated : i))
                            );
                          }}
                          onOpenChild={(childKey) => {
                            const found = issues.find(
                              (i) => i.key.toUpperCase() === childKey.toUpperCase()
                            );
                            if (found) {
                              setSelectedIssueId(found.id);
                            } else {
                              getIssueByKeyOrId(childKey).then((fetched) => {
                                if (fetched) {
                                  setIssues((prev) => [fetched as unknown as Issue, ...prev]);
                                  setSelectedIssueId(fetched.id);
                                }
                              });
                            }
                          }}
                        />
                      </div>

                      {/* Linked Issues Section */}
                      <div className="pt-2 border-t border-jira-gray-200 min-w-0">
                        <IssueLinksSection
                          issueId={selectedIssue.id}
                          linksAsSource={selectedIssue.linksAsSource}
                          linksAsTarget={selectedIssue.linksAsTarget}
                          canEdit={permissions.canEditIssue}
                          onIssueLinked={(link) => {
                            const updated = {
                              ...selectedIssue,
                              linksAsSource: [...(selectedIssue.linksAsSource || []), link],
                            };
                            setIssues((prev) =>
                              prev.map((i) => (i.id === selectedIssue.id ? updated : i))
                            );
                          }}
                          onIssueUnlinked={(linkId) => {
                            const updated = {
                              ...selectedIssue,
                              linksAsSource: (selectedIssue.linksAsSource || []).filter(
                                (l: any) => l.id !== linkId
                              ),
                              linksAsTarget: (selectedIssue.linksAsTarget || []).filter(
                                (l: any) => l.id !== linkId
                              ),
                            };
                            setIssues((prev) =>
                              prev.map((i) => (i.id === selectedIssue.id ? updated : i))
                            );
                          }}
                        />
                      </div>

                      {/* Comments & Activity */}
                      <div className="pt-2 border-t border-jira-gray-200">
                        <div className="flex items-center gap-4 mb-4">
                          <button
                            onClick={() => setActiveTab("comments")}
                            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                              activeTab === "comments"
                                ? "border-jira-blue text-jira-blue"
                                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Comments ({historyTotal(selectedIssue, "comments")})</span>
                          </button>
                          <button
                            onClick={() => setActiveTab("history")}
                            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                              activeTab === "history"
                                ? "border-jira-blue text-jira-blue"
                                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>History</span>
                          </button>
                        </div>

                        {activeTab === "comments" && (
                          <div className="space-y-4">
                            {permissions.canAddComment ? (
                              <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <MentionInput
                                    value={newComment}
                                    onChange={setNewComment}
                                    users={users}
                                    multiline={true}
                                    rows={2}
                                    placeholder="Add a comment... (Type @ to mention, paste images directly)"
                                    onSubmit={handleAddComment}
                                    onImagePaste={handleSplitViewImagePaste}
                                    className="w-full px-3 py-1.5 text-xs border border-jira-gray-300 rounded focus:border-jira-blue"
                                  />
                                  <p className="mt-1 text-[11px] text-jira-gray-400">Markdown supported</p>
                                </div>
                                <button
                                  type="submit"
                                  disabled={isSubmittingComment || !newComment.trim()}
                                  className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover disabled:opacity-50"
                                >
                                  Post
                                </button>
                              </form>
                            ) : (
                              <div className="p-3 bg-jira-gray-50 border border-jira-gray-200 rounded text-xs text-jira-gray-500 italic">
                                You do not have permission to post comments in this project.
                              </div>
                            )}

                            <div className="space-y-3 pt-2">
                              {selectedIssue.comments?.map((comment: any) => (
                                <div key={comment.id} className="flex gap-2.5 text-xs">
                                  <UserAvatar
                                    user={comment.author}
                                    size="sm"
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 bg-jira-gray-50 p-2.5 rounded border border-jira-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-jira-navy">
                                        {comment.author?.name}
                                      </span>
                                      <span className="text-[10px] text-jira-gray-500">
                                        {formatDistanceToNow(new Date(comment.createdAt), {
                                          addSuffix: true,
                                        })}
                                      </span>
                                    </div>
                                    <MarkdownContent
                                      text={comment.content}
                                      users={users}
                                      className="text-jira-gray-800"
                                    />
                                  </div>
                                </div>
                              ))}
                              <ShowOlderButton
                                remaining={historyRemaining(selectedIssue, "comments")}
                                noun="comments"
                                loading={loadingOlder === "comments"}
                                onClick={() => loadOlderHistory("comments")}
                              />
                            </div>
                          </div>
                        )}

                        {activeTab === "history" && (
                          <div className="space-y-2 text-xs">
                            {selectedIssue.activityLogs && selectedIssue.activityLogs.length > 0 ? (
                              selectedIssue.activityLogs.map((log: any) => (
                                <div
                                  key={log.id}
                                  className="flex items-center gap-2 py-1 text-jira-gray-700"
                                >
                                  <span className="font-bold text-jira-navy">
                                    {log.user?.name || "User"}
                                  </span>
                                  <span>{log.action.toLowerCase().replace("_", " ")}</span>
                                  {log.field && (
                                    <span className="font-medium text-jira-blue">
                                      [{log.field}]
                                    </span>
                                  )}
                                  {log.newValue && (
                                    <span>
                                      to <strong className="text-jira-navy">{log.newValue}</strong>
                                    </span>
                                  )}
                                  <span className="text-jira-gray-400 ml-auto">
                                    {formatDistanceToNow(new Date(log.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-jira-gray-400 italic">No activity recorded</div>
                            )}
                            <ShowOlderButton
                              remaining={historyRemaining(selectedIssue, "activity")}
                              noun="entries"
                              loading={loadingOlder === "activity"}
                              onClick={() => loadOlderHistory("activity")}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta Sidebar (1 col) */}
                    <div className="space-y-4 bg-jira-gray-50/70 p-4 rounded-lg border border-jira-gray-200 text-xs">
                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Assignee
                        </label>
                        <select
                          value={selectedIssue.assigneeId || ""}
                          disabled={!permissions.canEditIssue}
                          onChange={(e) =>
                            handleUpdateCurrentIssue({ assigneeId: e.target.value || null })
                          }
                          className={`w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy ${
                            !permissions.canEditIssue ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Priority
                        </label>
                        <div className="relative">
                          <select
                            value={selectedIssue.priority}
                            disabled={!permissions.canEditIssue}
                            onChange={(e) =>
                              handleUpdateCurrentIssue({
                                priority: e.target.value as PriorityLevel,
                              })
                            }
                            className={`w-full bg-white border border-jira-gray-300 rounded pl-7 pr-2 py-1 text-jira-navy ${
                              !permissions.canEditIssue ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <option value="HIGHEST">Highest</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                            <option value="LOWEST">Lowest</option>
                          </select>
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <PriorityIcon priority={selectedIssue.priority} className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Story Points
                        </label>
                        <input
                          type="number"
                          value={selectedIssue.storyPoints ?? ""}
                          disabled={!permissions.canEditIssue}
                          onChange={(e) =>
                            handleUpdateCurrentIssue({
                              storyPoints:
                                e.target.value === "" ? null : parseInt(e.target.value, 10),
                            })
                          }
                          placeholder="None"
                          className={`w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy ${
                            !permissions.canEditIssue ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Reporter
                        </label>
                        <div className="px-2 py-1 bg-white border border-jira-gray-300 rounded text-jira-navy">
                          {selectedIssue.reporter?.name || "Anonymous"}
                        </div>
                      </div>

                      {/* Sprint Selector (Hidden for Epics and Kanban projects) */}
                      {!((selectedIssue.project?.boardType ?? project?.boardType) === "KANBAN") && selectedIssue.type !== "EPIC" && (
                        <div>
                          <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                            Sprint
                          </label>
                          <select
                            value={selectedIssue.sprintId || ""}
                            disabled={!permissions.canEditIssue || !permissions.canMoveIssue}
                            onChange={(e) => {
                              const newSprintId = e.target.value || null;
                              if (newSprintId && newSprintId !== selectedIssue.sprintId) {
                                const targetSprint = sprints.find((s) => s.id === newSprintId);
                                if (targetSprint && targetSprint.status === "COMPLETED") {
                                  return;
                                }
                              }
                              const currentIsBacklog = statuses.find(
                                (s) => s.name === selectedIssue.status
                              )?.isBacklog;
                              const initialStatusName =
                                statuses.find((s) => !s.isBacklog)?.name ?? selectedIssue.status;
                              const newStatus =
                                newSprintId && currentIsBacklog ? initialStatusName : selectedIssue.status;
                              handleUpdateCurrentIssue({
                                sprintId: newSprintId,
                                status: newStatus,
                              });
                            }}
                            className={`w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy ${
                              !permissions.canEditIssue || !permissions.canMoveIssue ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <option value="">Backlog (No Sprint)</option>
                            {sprints
                              .filter((s) => s.status !== "COMPLETED" || s.id === selectedIssue.sprintId)
                              .map((s) => (
                                <option
                                  key={s.id}
                                  value={s.id}
                                  disabled={s.status === "COMPLETED" && s.id !== selectedIssue.sprintId}
                                >
                                  {s.name} {s.status === "ACTIVE" ? "(Active)" : s.status === "FUTURE" ? "(Planned / Unstarted)" : "(Completed - Closed)"}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Fix Version */}
                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Fix Version
                        </label>
                        <select
                          value={selectedIssue.versionId || ""}
                          disabled={!permissions.canEditIssue}
                          onChange={(e) => {
                            const vId = e.target.value || null;
                            const newVersion = versions.find((v) => v.id === vId) || null;
                            handleUpdateCurrentIssue({
                              versionId: vId,
                              version: newVersion,
                            });
                          }}
                          className={`w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy ${
                            !permissions.canEditIssue ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="">None (Unassigned)</option>
                          {selectedIssue.version &&
                            !versions.some((v) => v.id === selectedIssue.version!.id) && (
                              <option key={selectedIssue.version.id} value={selectedIssue.version.id}>
                                {selectedIssue.version.name} ({selectedIssue.version.status})
                              </option>
                            )}
                          {versions.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pt-3 border-t border-jira-gray-200 text-[11px] text-jira-gray-500 space-y-1">
                        <div>
                          Created:{" "}
                          {format(new Date(selectedIssue.createdAt), "MMM d, yyyy, h:mm a")}
                        </div>
                        <div>
                          Updated:{" "}
                          {format(new Date(selectedIssue.updatedAt), "MMM d, yyyy, h:mm a")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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

      {/* Modal for Table View Row Click */}
      {modalIssue && (
        <IssueDetailModal
          issue={modalIssue}
          users={users}
          allIssues={issues}
          sprints={sprints}
          versions={versions}
          // Only the row's own project resolves membership correctly; a row
          // from a different project (the "All Projects" filter) falls back
          // to the issue's own project relation, same as before this prop existed.
          project={modalIssue.projectId === project?.id ? project : undefined}
          onActiveIssueChange={(newIssue) => setModalIssue(newIssue)}
          onClose={handleCloseDetailModal}
          onIssueUpdated={(up) => {
            setIssues((prev) => prev.map((i) => (i.id === up.id ? up : i)));
            setModalIssue(up);
          }}
          onIssueDeleted={(id) => {
            setIssues((prev) => prev.filter((i) => i.id !== id));
            setModalIssue(null);
          }}
        />
      )}
    </div>
  );
}
