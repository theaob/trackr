"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Project, Issue, User, Sprint, Version, IssueType, PriorityLevel, IssueStatus } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";

import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import IssueDetailModal from "./IssueDetailModal";
import MentionInput from "@/components/common/MentionInput";
import MentionText from "@/components/common/MentionText";
import { updateIssue, deleteIssue, getPaginatedIssues, getIssueByKeyOrId } from "@/lib/actions/issues";
import { addComment, deleteComment } from "@/lib/actions/comments";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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
  initialSelectedIssueKey?: string;
}

type FilterPreset =
  | "ALL"
  | "MY_OPEN"
  | "REPORTED_BY_ME"
  | "RECENTLY_UPDATED"
  | "DONE"
  | "HIGH_PRIORITY";

type SortField = "key" | "title" | "status" | "priority" | "storyPoints" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

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
  initialSelectedIssueKey,
}: IssuesListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedIssueKey =
    searchParams?.get("selectedIssue") || searchParams?.get("issue") || initialSelectedIssueKey;

  const { currentUser } = useCurrentUser();
  const { searchQuery: globalSearchQuery } = useSearch();

  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount ?? initialIssues.length);
  const [page, setPage] = useState<number>(initialPage ?? 1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize ?? 50);
  const [totalPages, setTotalPages] = useState<number>(
    initialTotalPages ?? Math.max(1, Math.ceil((initialTotalCount ?? initialIssues.length) / (initialPageSize ?? 50)))
  );
  const [isLoading, setIsLoading] = useState(false);

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    initialIssues.length > 0 ? initialIssues[0].id : null
  );
  const [modalIssue, setModalIssue] = useState<Issue | null>(null);

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

    window.addEventListener("jira:open-issue", handleOpenIssueEvent);
    return () => {
      window.removeEventListener("jira:open-issue", handleOpenIssueEvent);
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

  // Filter States
  const [projectFilter, setProjectFilter] = useState<string>(project?.id || "ALL");
  const [preset, setPreset] = useState<FilterPreset>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<IssueType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [reporterFilter, setReporterFilter] = useState<string>("ALL");
  const [sprintFilter, setSprintFilter] = useState<string>("ALL");
  const [versionFilter, setVersionFilter] = useState<string>("ALL");

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

  // Server-side fetch on filter/pagination/sorting changes
  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getPaginatedIssues({
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
        sortField,
        sortOrder,
      });
      setIssues(res.issues as any);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
      setSelectedIssueId((prevId) => {
        if (res.issues.length === 0) return null;
        if (!prevId || !res.issues.some((i: any) => i.id === prevId)) {
          return res.issues[0].id;
        }
        return prevId;
      });
    } catch (err) {
      console.error("Failed to load paginated issues", err);
    } finally {
      setIsLoading(false);
    }
  }, [
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

  // Reset Filters
  const handleClearFilters = () => {
    setPreset("ALL");
    setSearchQuery("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setAssigneeFilter("ALL");
    setReporterFilter("ALL");
    setSprintFilter("ALL");
    setVersionFilter("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    preset !== "ALL" ||
    searchQuery.trim() !== "" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    reporterFilter !== "ALL" ||
    sprintFilter !== "ALL" ||
    versionFilter !== "ALL";

  // Issues displayed on current page
  const filteredAndSortedIssues = issues;

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
  useEffect(() => {
    if (!selectedIssue || selectedIssue.comments) return;

    let cancelled = false;
    const targetId = selectedIssue.id;

    getIssueByKeyOrId(targetId).then((fetched) => {
      if (cancelled || !fetched) return;
      const typed = fetched as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === typed.id ? typed : i)));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedIssue]);

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

  // Issue update handler
  const handleUpdateCurrentIssue = async (data: Partial<Issue>) => {
    if (!selectedIssue) return;
    const res = await updateIssue(selectedIssue.id, {
      ...data,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const updated = res.issue as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  };

  // Add Comment in Split View
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || !selectedIssue) return;
    setIsSubmittingComment(true);
    const res = await addComment(selectedIssue.id, currentUser.id, newComment);
    setIsSubmittingComment(false);
    if (res.success && res.comment) {
      setNewComment("");
      const updatedComments = [res.comment, ...(selectedIssue.comments || [])];
      const updated = { ...selectedIssue, comments: updatedComments };
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Top Header & Preset Bar */}
      <div className="px-6 pt-5 pb-3 border-b border-jira-gray-200 shrink-0 space-y-3">
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
              className="text-xs font-medium text-jira-navy bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
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

        {/* Preset Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                preset === tab.id
                  ? "bg-jira-blue text-white font-semibold shadow-xs"
                  : "bg-jira-gray-100 text-jira-gray-700 hover:bg-jira-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Keyword Search & Search/Refresh Button */}
          <div className="flex items-center gap-1.5">
            <div className="relative w-48 sm:w-56">
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
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
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
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-semibold outline-none focus:border-jira-blue"
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
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
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
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">Status: All</option>
            <option value="BACKLOG">Backlog</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as PriorityLevel | "ALL");
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">Priority: All</option>
            <option value="HIGHEST">Highest</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="LOWEST">Lowest</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">Assignee: All</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Sprint Filter */}
          <select
            value={sprintFilter}
            onChange={(e) => {
              setSprintFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
          >
            <option value="ALL">Sprint: All</option>
            <option value="BACKLOG">Backlog (No Sprint)</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Version Filter */}
          {versions.length > 0 && (
            <select
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-jira-navy font-medium outline-none focus:border-jira-blue"
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

          {/* Sort Field & Order */}
          <div className="flex items-center gap-1 border-l border-jira-gray-300 pl-2 ml-1">
            <span className="text-[11px] text-jira-gray-500">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as SortField);
                setPage(1);
              }}
              className="text-xs bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy outline-none"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="priority">Priority</option>
              <option value="key">Key</option>
              <option value="status">Status</option>
              <option value="storyPoints">Story Points</option>
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {viewMode === "split" ? (
          /* SPLIT VIEW: Left List + Right Details */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Issue List */}
            <div className="w-80 lg:w-96 border-r border-jira-gray-300 overflow-y-auto divide-y divide-jira-gray-200 shrink-0 bg-white">
              {filteredAndSortedIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-jira-gray-500">
                  No issues found matching your filters.
                </div>
              ) : (
                filteredAndSortedIssues.map((issue) => {
                  const isSelected = selectedIssue?.id === issue.id;
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

                      <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-jira-gray-500">
                        <span>
                          {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                        </span>
                        <div className="flex items-center gap-2">
                          {issue.storyPoints !== null && (
                            <span className="px-1.5 py-0.2 rounded-full bg-jira-gray-200 text-jira-gray-700 font-bold text-[10px]">
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
            <div className="flex-1 overflow-y-auto bg-white p-6">
              {selectedIssue ? (
                <div className="max-w-4xl space-y-6">
                  {/* Issue Key & Status Ribbon */}
                  <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200">
                    <div className="flex items-center gap-2">
                      <IssueTypeBadge type={selectedIssue.type} size="sm" showLabel />
                      <span className="text-sm font-bold text-jira-gray-700">{selectedIssue.key}</span>
                      {selectedIssue.parent && (
                        <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          {selectedIssue.parent.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={selectedIssue.status}
                        onChange={(e) =>
                          handleUpdateCurrentIssue({ status: e.target.value as IssueStatus })
                        }
                        className="bg-white border border-jira-gray-300 rounded px-2.5 py-1 text-xs font-bold text-jira-navy focus:border-jira-blue outline-none"
                      >
                        <option value="BACKLOG">Backlog</option>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-jira-navy leading-snug">
                      {selectedIssue.title}
                    </h2>
                  </div>

                  {/* Two Column Layout for Issue Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Details (2 cols) */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Description */}
                      <div>
                        <h4 className="text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-2">
                          Description
                        </h4>
                        <div className="p-3 bg-jira-gray-50/70 border border-jira-gray-200 rounded-md text-sm text-jira-navy leading-relaxed min-h-[90px]">
                          {selectedIssue.description ? (
                            <MentionText text={selectedIssue.description} users={users} />
                          ) : (
                            <span className="text-jira-gray-400 italic">No description provided</span>
                          )}
                        </div>
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
                            <span>Comments ({selectedIssue.comments?.length || 0})</span>
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
                            <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                              <MentionInput
                                value={newComment}
                                onChange={setNewComment}
                                users={users}
                                multiline={false}
                                placeholder="Add a comment... (Type @ to mention someone)"
                                onSubmit={handleAddComment}
                                className="flex-1 px-3 py-1.5 text-xs border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                              />
                              <button
                                type="submit"
                                disabled={isSubmittingComment || !newComment.trim()}
                                className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover disabled:opacity-50"
                              >
                                Post
                              </button>
                            </form>

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
                                    <MentionText
                                      text={comment.content}
                                      users={users}
                                      className="text-jira-gray-800"
                                    />
                                  </div>
                                </div>
                              ))}
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
                          onChange={(e) =>
                            handleUpdateCurrentIssue({ assigneeId: e.target.value || null })
                          }
                          className="w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy outline-none"
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
                        <select
                          value={selectedIssue.priority}
                          onChange={(e) =>
                            handleUpdateCurrentIssue({
                              priority: e.target.value as PriorityLevel,
                            })
                          }
                          className="w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy outline-none"
                        >
                          <option value="HIGHEST">Highest</option>
                          <option value="HIGH">High</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="LOW">Low</option>
                          <option value="LOWEST">Lowest</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Story Points
                        </label>
                        <input
                          type="number"
                          value={selectedIssue.storyPoints ?? ""}
                          onChange={(e) =>
                            handleUpdateCurrentIssue({
                              storyPoints:
                                e.target.value === "" ? null : parseInt(e.target.value, 10),
                            })
                          }
                          placeholder="None"
                          className="w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy outline-none"
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

                      {/* Sprint Selector */}
                      <div>
                        <label className="block font-bold text-jira-gray-600 uppercase tracking-wider mb-1">
                          Sprint
                        </label>
                        <select
                          value={selectedIssue.sprintId || ""}
                          onChange={(e) => {
                            const newSprintId = e.target.value || null;
                            if (newSprintId && newSprintId !== selectedIssue.sprintId) {
                              const targetSprint = sprints.find((s) => s.id === newSprintId);
                              if (targetSprint && targetSprint.status === "COMPLETED") {
                                return;
                              }
                            }
                            const newStatus =
                              newSprintId && selectedIssue.status === "BACKLOG"
                                ? "TODO"
                                : selectedIssue.status;
                            handleUpdateCurrentIssue({
                              sprintId: newSprintId,
                              status: newStatus,
                            });
                          }}
                          className="w-full bg-white border border-jira-gray-300 rounded px-2 py-1 text-jira-navy outline-none"
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
          <div className="flex-1 overflow-auto p-6">
            <div className="border border-jira-gray-300 rounded-lg overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left text-xs text-jira-navy">
                <thead className="bg-jira-gray-100 text-jira-gray-700 font-bold uppercase tracking-wider border-b border-jira-gray-300">
                  <tr>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Key</th>
                    <th className="py-2.5 px-3">Summary</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Points</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jira-gray-200">
                  {filteredAndSortedIssues.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-jira-gray-500">
                        No issues found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedIssues.map((issue) => (
                      <tr
                        key={issue.id}
                        onClick={() => setModalIssue(issue)}
                        className="hover:bg-jira-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-3">
                          <IssueTypeBadge type={issue.type} size="xs" />
                        </td>
                        <td className="py-2 px-3 font-bold text-jira-blue">{issue.key}</td>
                        <td className="py-2 px-3 font-medium max-w-md truncate">{issue.title}</td>
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
      <div className="px-6 py-2.5 bg-jira-gray-50 border-t border-jira-gray-300 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs text-jira-gray-700">
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
              className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-jira-blue focus:outline-none"
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
            <div className="flex items-center gap-1.5 pl-2 border-l border-jira-gray-300">
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
                className="w-14 bg-white border border-jira-gray-300 rounded px-1.5 py-1 text-xs text-center focus:ring-1 focus:ring-jira-blue focus:outline-none"
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
