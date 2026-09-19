"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Project, Issue, User, IssueStatus, IssueType, PriorityLevel, Sprint, WorkflowStatus, WorkflowTransition } from "@/types";
import KanbanColumn from "./KanbanColumn";
import BoardFilters, { SwimlaneGroupBy } from "./BoardFilters";
import IssueDetailModal from "@/components/issues/IssueDetailModal";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import UserAvatar from "@/components/common/UserAvatar";
import { updateIssueStatusAndOrder, getIssueByKeyOrId } from "@/lib/actions/issues";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { prettifyStatusName, isDoneStatus, getDoneStatusNames } from "@/lib/workflowDisplay";
import { ChevronDown, ChevronRight, Layers, User as UserIcon, Bookmark, AlertCircle } from "lucide-react";
import Link from "next/link";

interface KanbanBoardProps {
  project: Project;
  initialIssues: Issue[];
  users: User[];
  sprints: Sprint[];
  /** The project's non-backlog workflow statuses, in column order. */
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  searchQuery?: string;
  initialSelectedIssueKey?: string;
  initialEpics?: Issue[];
}

interface Swimlane {
  id: string;
  title: string;
  user?: User | null;
  epic?: Issue | null;
  priority?: PriorityLevel;
}

export default function KanbanBoard({
  project,
  initialIssues,
  users,
  sprints,
  statuses,
  transitions,
  searchQuery: propSearchQuery,
  initialSelectedIssueKey,
  initialEpics,
}: KanbanBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIssueKey =
    searchParams?.get("selectedIssue") || searchParams?.get("issue") || initialSelectedIssueKey;

  // Kanban ignores sprints entirely: the board is every non-backlog issue in
  // continuous flow, never scoped to whatever happens to be "active".
  const isKanban = project.boardType === "KANBAN";
  const activeSprint = isKanban ? undefined : sprints.find((s) => s.status === "ACTIVE");

  // Board columns: the project's own workflow statuses, in the order it
  // configured, rather than a fixed list. WIP limits are Kanban-only.
  const COLUMNS = useMemo(
    () =>
      statuses.map((s) => ({
        id: s.name,
        title: prettifyStatusName(s.name),
        wipLimit: isKanban ? (s.wipLimit ?? undefined) : undefined,
        color: s.color,
      })),
    [statuses, isKanban]
  );

  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(project);
  const { searchQuery: contextSearchQuery } = useSearch();
  const searchQuery = propSearchQuery ?? contextSearchQuery;

  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Grouping / Swimlane state
  const [groupBy, setGroupBy] = useState<SwimlaneGroupBy>("NONE");
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});

  // Sync issues if initialIssues prop updates
  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Handle selectedIssue query parameter
  useEffect(() => {
    if (!selectedIssueKey) return;
    const found = issues.find(
      (i) =>
        i.key.toUpperCase() === selectedIssueKey.toUpperCase() ||
        i.id === selectedIssueKey
    );
    if (found) {
      setActiveIssue(found);
    } else {
      getIssueByKeyOrId(selectedIssueKey).then((fetched) => {
        if (fetched) {
          setActiveIssue(fetched as unknown as Issue);
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
        setActiveIssue(found);
      } else {
        getIssueByKeyOrId(targetKey).then((fetched) => {
          if (fetched) {
            setActiveIssue(fetched as unknown as Issue);
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
    setActiveIssue(null);
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

  // Filters State
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<IssueType | "ALL">("ALL");
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | "ALL">("ALL");
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);

  // Toggle Assignee Filter
  const handleToggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSelectedAssigneeIds([]);
    setSelectedType("ALL");
    setSelectedPriority("ALL");
    setOnlyMyIssues(false);
  };

  const hasActiveFilters =
    selectedAssigneeIds.length > 0 ||
    selectedType !== "ALL" ||
    selectedPriority !== "ALL" ||
    onlyMyIssues ||
    searchQuery.trim().length > 0;

  const boardStatusNames = useMemo(() => new Set(COLUMNS.map((c) => c.id)), [COLUMNS]);
  const doneStatusNames = useMemo(() => {
    return getDoneStatusNames(statuses);
  }, [statuses]);

  // Active sprint story points calculations
  const sprintIssues = useMemo(() => {
    if (!activeSprint) return [];
    return issues.filter(
      (i) => i.sprintId === activeSprint.id || (!i.sprintId && !isKanban)
    );
  }, [issues, activeSprint, isKanban]);

  const sprintTotalPoints = useMemo(
    () => sprintIssues.reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0),
    [sprintIssues]
  );

  const sprintDonePoints = useMemo(
    () =>
      sprintIssues
        .filter((i) => isDoneStatus(i.status, statuses))
        .reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0),
    [sprintIssues, statuses]
  );

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Only show issues for active sprint or unassigned to sprint if no active sprint
      if (activeSprint) {
        if (issue.sprintId !== activeSprint.id) return false;
        if (issue.type === "EPIC") return false;
      } else {
        if (!boardStatusNames.has(issue.status)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle) return false;
      }

      // Only My Issues
      if (onlyMyIssues && currentUser) {
        if (issue.assigneeId !== currentUser.id) return false;
      }

      // Assignee Avatars
      if (selectedAssigneeIds.length > 0) {
        if (!issue.assigneeId || !selectedAssigneeIds.includes(issue.assigneeId)) {
          return false;
        }
      }

      // Type Filter
      if (selectedType !== "ALL" && issue.type !== selectedType) {
        return false;
      }

      // Priority Filter
      if (selectedPriority !== "ALL" && issue.priority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [
    issues,
    activeSprint,
    searchQuery,
    onlyMyIssues,
    currentUser,
    selectedAssigneeIds,
    selectedType,
    selectedPriority,
    boardStatusNames,
  ]);

  // Epics list for parent selectors and swimlanes
  const epics = useMemo(() => {
    if (initialEpics && initialEpics.length > 0) return initialEpics;
    return issues.filter((i) => i.type === "EPIC");
  }, [issues, initialEpics]);

  // Build Swimlanes based on groupBy
  const swimlanes = useMemo<Swimlane[]>(() => {
    if (groupBy === "NONE") {
      return [{ id: "ALL", title: "" }];
    }

    if (groupBy === "ASSIGNEE") {
      const userLanes: Swimlane[] = users.map((u) => ({
        id: u.id,
        title: u.name,
        user: u,
      }));
      userLanes.push({
        id: "UNASSIGNED",
        title: "Unassigned",
        user: null,
      });
      return userLanes;
    }

    if (groupBy === "EPIC") {
      const epicLanes: Swimlane[] = epics.map((epic) => ({
        id: epic.id,
        title: `${epic.title} (${epic.key})`,
        epic: epic,
      }));
      epicLanes.push({
        id: "NO_EPIC",
        title: "Issues without Epic",
        epic: null,
      });
      return epicLanes;
    }

    if (groupBy === "PRIORITY") {
      const priorities: PriorityLevel[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];
      return priorities.map((p) => ({
        id: p,
        title: `${p.charAt(0) + p.slice(1).toLowerCase()} Priority`,
        priority: p,
      }));
    }

    return [{ id: "ALL", title: "" }];
  }, [groupBy, users, epics]);

  // Get issues for a specific cell (swimlane + status)
  const getCellIssues = (swimlaneId: string, status: IssueStatus): Issue[] => {
    const list = filteredIssues.filter((issue) => {
      if (issue.status !== status) return false;

      if (groupBy === "NONE") return true;

      if (groupBy === "ASSIGNEE") {
        if (swimlaneId === "UNASSIGNED") return !issue.assigneeId;
        return issue.assigneeId === swimlaneId;
      }

      if (groupBy === "EPIC") {
        if (swimlaneId === "NO_EPIC") return !issue.parentId;
        return issue.parentId === swimlaneId;
      }

      if (groupBy === "PRIORITY") {
        return issue.priority === swimlaneId;
      }

      return true;
    });

    // Sort deterministically by order ascending, then by createdAt
    return list.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  // Helper to parse droppableId format "laneId::status" or "status"
  const parseDroppableId = (droppableId: string) => {
    if (droppableId.includes("::")) {
      const [laneId, status] = droppableId.split("::");
      return { laneId, status: status as IssueStatus };
    }
    return { laneId: "ALL", status: droppableId as IssueStatus };
  };

  // Handle Drag & Drop with proper ordering & swimlane attribute updates
  const handleDragEnd = async (result: DropResult) => {
    if (!permissions.canMoveIssue) return;

    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const src = parseDroppableId(source.droppableId);
    const dest = parseDroppableId(destination.droppableId);

    const targetIssue = issues.find((i) => i.id === draggableId);
    if (!targetIssue) return;

    // Snapshot current issues for rollback on failure
    const previousIssues = issues;

    // Prepare extra swimlane field updates
    const extraData: {
      assigneeId?: string | null;
      parentId?: string | null;
      priority?: PriorityLevel;
      sprintId?: string | null;
    } = {};
    let updatedAssignee = targetIssue.assignee;
    let updatedParent = targetIssue.parent;
    let updatedPriority = targetIssue.priority;
    let updatedSprintId = targetIssue.sprintId;

    if (activeSprint && !targetIssue.sprintId && !isKanban) {
      extraData.sprintId = activeSprint.id;
      updatedSprintId = activeSprint.id;
    }

    if (groupBy === "ASSIGNEE" && dest.laneId !== src.laneId) {
      const newAssigneeId = dest.laneId === "UNASSIGNED" ? null : dest.laneId;
      extraData.assigneeId = newAssigneeId;
      updatedAssignee = newAssigneeId ? users.find((u) => u.id === newAssigneeId) || null : null;
    } else if (groupBy === "EPIC" && dest.laneId !== src.laneId) {
      const newParentId = dest.laneId === "NO_EPIC" ? null : dest.laneId;
      extraData.parentId = newParentId;
      updatedParent = newParentId ? epics.find((e) => e.id === newParentId) || null : null;
    } else if (groupBy === "PRIORITY" && dest.laneId !== src.laneId) {
      const newPriority = dest.laneId as PriorityLevel;
      extraData.priority = newPriority;
      updatedPriority = newPriority;
    }

    // Target cell items (excluding moved issue)
    const targetCellIssues = getCellIssues(dest.laneId, dest.status).filter((i) => i.id !== draggableId);

    const updatedTargetIssue: Issue = {
      ...targetIssue,
      status: dest.status,
      priority: updatedPriority,
      sprintId: updatedSprintId,
      assigneeId: extraData.assigneeId !== undefined ? extraData.assigneeId : targetIssue.assigneeId,
      assignee: updatedAssignee,
      parentId: extraData.parentId !== undefined ? extraData.parentId : targetIssue.parentId,
      parent: updatedParent as any,
    };

    // Insert at destination index
    targetCellIssues.splice(destination.index, 0, updatedTargetIssue);

    // Reassign contiguous order indexes to target cell items
    const orderMap = new Map<string, number>();
    targetCellIssues.forEach((item, idx) => {
      orderMap.set(item.id, idx);
    });

    // Update global issues state deterministically
    setIssues((prevIssues) =>
      prevIssues.map((item) => {
        if (orderMap.has(item.id)) {
          if (item.id === draggableId) {
            return { ...updatedTargetIssue, order: orderMap.get(item.id)! };
          }
          return { ...item, order: orderMap.get(item.id)! };
        }
        return item;
      })
    );

    // Persist via Server Action. The whole destination column goes with it, so
    // the neighbours' positions are stored too and the board looks the same
    // after a reload as it did after the drop.
    const res = await updateIssueStatusAndOrder(
      draggableId,
      dest.status,
      destination.index,
      currentUser?.id,
      extraData,
      targetCellIssues.map((item) => item.id)
    );

    if (res.success && res.issue) {
      const serverIssue = res.issue as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === serverIssue.id ? { ...i, ...serverIssue } : i)));
    } else if (!res.success) {
      setIssues(previousIssues);
      if (res.error) {
        alert(res.error);
      }
    }
  };

  // Update handlers
  const handleIssueUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (activeIssue?.id === updated.id) {
      setActiveIssue(updated);
    }
  };

  const handleIssueDeleted = (deletedId: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== deletedId));
    if (activeIssue?.id === deletedId) {
      setActiveIssue(null);
    }
  };

  const handleIssueCreated = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...prev]);
  };

  const toggleLaneCollapse = (laneId: string) => {
    setCollapsedLanes((prev) => ({ ...prev, [laneId]: !prev[laneId] }));
  };

  const handleOpenEpic = (epicIdOrKey: string) => {
    const found = issues.find(
      (i) => i.id === epicIdOrKey || i.key.toUpperCase() === epicIdOrKey.toUpperCase()
    );
    if (found) {
      setActiveIssue(found);
    } else {
      getIssueByKeyOrId(epicIdOrKey).then((fetched) => {
        if (fetched) {
          setActiveIssue(fetched as unknown as Issue);
        }
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden px-6 pt-5 bg-white">
      {/* Board Header & Sprint Info */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-jira-navy tracking-tight">
              {activeSprint ? activeSprint.name : isKanban ? "Kanban Board" : "Scrum Board"}
            </h1>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded border bg-jira-gray-100 text-jira-gray-700 border-jira-gray-200"
            >
              {isKanban ? "Kanban" : "Scrum"}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
            {activeSprint && (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Active Sprint
                </span>
                <div className="flex items-center gap-1 text-xs ml-1">
                  <span
                    title="Total estimated story points"
                    className="px-2 py-0.5 rounded-full bg-jira-gray-200 text-jira-gray-800 font-bold text-[11px]"
                  >
                    {sprintTotalPoints} pts
                  </span>
                  <span
                    title="Completed story points"
                    className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]"
                  >
                    {sprintDonePoints} done
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!activeSprint && !isKanban && (
              <Link
                href={`/projects/${project.key}/backlog`}
                className="text-xs bg-jira-blue-light text-jira-blue font-semibold px-3 py-1.5 rounded hover:bg-jira-blue hover:text-white transition-colors"
              >
                Go to Backlog to start a sprint
              </Link>
            )}
          </div>
        </div>

        {!activeSprint && !isKanban && (
          <p className="text-xs text-jira-gray-500 mt-0.5">
            No active sprint. Issues assigned to the active sprint in the backlog will appear here.
          </p>
        )}

        {activeSprint?.goal && (
          <p className="text-xs text-jira-gray-600 italic">
            Goal: {activeSprint.goal}
          </p>
        )}

        {/* Filters Bar */}
        <BoardFilters
          users={users}
          selectedAssigneeIds={selectedAssigneeIds}
          onToggleAssignee={handleToggleAssignee}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          selectedPriority={selectedPriority}
          onSelectPriority={setSelectedPriority}
          groupBy={groupBy}
          onSelectGroupBy={setGroupBy}
          onlyMyIssues={onlyMyIssues}
          onToggleOnlyMyIssues={() => setOnlyMyIssues(!onlyMyIssues)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto py-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          {groupBy === "NONE" ? (
            /* Default Single Grid Board */
            <div className="flex items-start gap-4 h-full min-w-max pb-2">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  id={col.id}
                  title={col.title}
                  wipLimit={col.wipLimit}
                  issues={getCellIssues("ALL", col.id)}
                  onIssueClick={(issue) => setActiveIssue(issue)}
                  doneStatusNames={doneStatusNames}
                  onSelectEpic={handleOpenEpic}
                />
              ))}
            </div>
          ) : (
            /* Swimlane / Lane Grouped Board */
            <div className="flex flex-col gap-6 min-w-max pb-6">
              {/* Column Headers Sticky Row */}
              <div className="flex items-center gap-4 sticky top-0 bg-white z-20 pb-2 border-b border-jira-gray-200">
                {COLUMNS.map((col) => {
                  const totalInCol = swimlanes.reduce(
                    (acc, lane) => acc + getCellIssues(lane.id, col.id).length,
                    0
                  );
                  const isOverLimit = !!(col.wipLimit && totalInCol > col.wipLimit);
                  const tooltipText = col.wipLimit
                    ? isOverLimit
                      ? `Work in progress (WIP) limit exceeded: ${totalInCol} of ${col.wipLimit} max issues`
                      : `Work in progress (WIP) limit: ${totalInCol} of ${col.wipLimit} issues`
                    : `${totalInCol} ${totalInCol === 1 ? "issue" : "issues"}`;

                  return (
                    <div
                      key={col.id}
                      className="w-72 shrink-0 flex items-center justify-between px-3 py-2 bg-jira-gray-100 rounded-md border border-jira-gray-200"
                    >
                      <h3 className="text-xs font-bold text-jira-navy uppercase tracking-wider">
                        {col.title}
                      </h3>
                      <div className="relative group/wip inline-flex items-center">
                        <span
                          title={tooltipText}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full cursor-help transition-colors ${
                            isOverLimit
                              ? "bg-rose-100 text-rose-700 font-bold animate-pulse hover:bg-rose-200"
                              : "bg-jira-gray-200 text-jira-gray-700 hover:bg-jira-gray-300"
                          }`}
                        >
                          {totalInCol}
                          {col.wipLimit ? ` / ${col.wipLimit}` : ""}
                        </span>

                        {/* Styled Floating Tooltip */}
                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover/wip:flex flex-col items-center z-30 whitespace-nowrap">
                          <div
                            className={`text-[11px] font-medium px-2.5 py-1 rounded shadow-lg ${
                              isOverLimit
                                ? "bg-rose-900 text-rose-100 border border-rose-700"
                                : "bg-jira-navy text-white"
                            }`}
                          >
                            {col.wipLimit ? (
                              <span>
                                {isOverLimit ? "WIP limit exceeded: " : "WIP limit: "}
                                <strong>{totalInCol}</strong> / {col.wipLimit} max issues
                              </span>
                            ) : (
                              <span>
                                {totalInCol} {totalInCol === 1 ? "issue" : "issues"}
                              </span>
                            )}
                          </div>
                          <div
                            className={`w-2 h-2 -mt-1 rotate-45 ${
                              isOverLimit
                                ? "bg-rose-900 border-r border-b border-rose-700"
                                : "bg-jira-navy"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Swimlane Rows */}
              {swimlanes.map((lane) => {
                const isCollapsed = collapsedLanes[lane.id];
                const laneIssueCount = COLUMNS.reduce(
                  (acc, col) => acc + getCellIssues(lane.id, col.id).length,
                  0
                );

                return (
                  <div
                    key={lane.id}
                    className="flex flex-col rounded-lg border border-jira-gray-200 bg-jira-gray-50/50 overflow-hidden shadow-2xs"
                  >
                    {/* Swimlane Header Bar */}
                    <div
                      onClick={() => toggleLaneCollapse(lane.id)}
                      className="flex items-center justify-between px-4 py-2.5 bg-jira-gray-100/80 hover:bg-jira-gray-200/80 border-b border-jira-gray-200 cursor-pointer select-none transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-jira-gray-600 hover:text-jira-navy transition-colors">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Swimlane Identity Rendering */}
                        {groupBy === "ASSIGNEE" && (
                          <div className="flex items-center gap-2">
                            {lane.user ? (
                              <UserAvatar user={lane.user} size="sm" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-jira-gray-300 flex items-center justify-center text-jira-gray-600">
                                <UserIcon className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="text-xs font-bold text-jira-navy">
                              {lane.title}
                            </span>
                            {lane.user?.role && (
                              <span className="text-[10px] bg-jira-gray-200 text-jira-gray-700 px-1.5 py-0.5 rounded font-medium">
                                {lane.user.role}
                              </span>
                            )}
                          </div>
                        )}

                        {groupBy === "EPIC" && (
                          <div
                            onClick={(e) => {
                              if (lane.id !== "NO_EPIC") {
                                e.stopPropagation();
                                handleOpenEpic(lane.id);
                              }
                            }}
                            className={`flex items-center gap-2 ${
                              lane.id !== "NO_EPIC" ? "cursor-pointer hover:underline" : ""
                            }`}
                            title={lane.id !== "NO_EPIC" ? "Click to view Epic details" : undefined}
                          >
                            <Bookmark className="w-4 h-4 text-purple-600 fill-purple-100" />
                            <span className="text-xs font-bold text-jira-navy">
                              {lane.title}
                            </span>
                          </div>
                        )}

                        {groupBy === "PRIORITY" && (
                          <div className="flex items-center gap-2">
                            <AlertCircle
                              className={`w-4 h-4 ${
                                lane.priority === "HIGHEST" || lane.priority === "HIGH"
                                  ? "text-rose-600"
                                  : lane.priority === "MEDIUM"
                                  ? "text-amber-600"
                                  : "text-blue-600"
                              }`}
                            />
                            <span className="text-xs font-bold text-jira-navy">
                              {lane.title}
                            </span>
                          </div>
                        )}

                        <span className="text-xs text-jira-gray-500 font-medium ml-1">
                          ({laneIssueCount} issue{laneIssueCount !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>

                    {/* Swimlane Columns Content */}
                    {!isCollapsed && (
                      <div className="flex items-start gap-4 p-3 bg-white">
                        {COLUMNS.map((col) => (
                          <KanbanColumn
                            key={`${lane.id}::${col.id}`}
                            id={col.id}
                            droppableId={`${lane.id}::${col.id}`}
                            title={col.title}
                            wipLimit={col.wipLimit}
                            showHeader={false}
                            minHeightClass="min-h-[110px]"
                            issues={getCellIssues(lane.id, col.id)}
                            onIssueClick={(issue) => setActiveIssue(issue)}
                            doneStatusNames={doneStatusNames}
                            onSelectEpic={handleOpenEpic}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DragDropContext>
      </div>

      {/* Modals */}
      {activeIssue && (
        <IssueDetailModal
          issue={activeIssue}
          users={users}
          allIssues={[...epics, ...issues]}
          sprints={sprints}
          project={project}
          onClose={handleCloseDetailModal}
          onIssueUpdated={handleIssueUpdated}
          onIssueDeleted={handleIssueDeleted}
        />
      )}

      {isCreateModalOpen && (
        <CreateIssueModal
          project={project}
          users={users}
          sprints={sprints}
          epics={epics}
          onClose={() => setIsCreateModalOpen(false)}
          onIssueCreated={handleIssueCreated}
        />
      )}
    </div>
  );
}
