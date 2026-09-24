"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Project, Issue, User, IssueStatus, PriorityLevel, Sprint, WorkflowStatus, WorkflowTransition, Version } from "@/types";
import KanbanColumn from "./KanbanColumn";
import BoardFilters, { SwimlaneGroupBy } from "./BoardFilters";
import SprintHeader from "./SprintHeader";
import { ColumnCount, ColumnTitle } from "./KanbanColumn";
import type { CardMoveOptions } from "./IssueCard";
import IssuePanel from "@/components/issue/IssuePanel";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import UserAvatar from "@/components/common/UserAvatar";
import { updateIssueStatusAndOrder, getIssueByKeyOrId, getBoardIssues } from "@/lib/actions/issues";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { prettifyStatusName, isDoneStatus, getDoneStatusNames } from "@/lib/workflowDisplay";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Rocket, ListTodo } from "lucide-react";
import { boardFiltersToTQL, matchesBoardFilters, moveTargets, NO_BOARD_FILTERS, sprintProgress, type BoardFilterState } from "@/lib/board";
import { IconButton } from "@/components/ui/Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import EditSprintModal from "@/components/sprints/EditSprintModal";
import CreateVersionModal from "@/components/releases/CreateVersionModal";
import Link from "next/link";
import { PriorityIcon } from "@/components/common/IssueIcons";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";

interface KanbanBoardProps {
  project: Project;
  initialIssues: Issue[];
  users: User[];
  sprints: Sprint[];
  versions?: Version[];
  /** The project's non-backlog workflow statuses, in column order. */
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  searchQuery?: string;
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
  versions = [],
  statuses,
  transitions,
  searchQuery: propSearchQuery,
  initialEpics,
}: KanbanBoardProps) {
  const router = useRouter();

  // Kanban ignores sprints entirely: the board is every non-backlog issue in
  // continuous flow, never scoped to whatever happens to be "active".
  const isKanban = project.boardType === "KANBAN";
  const [boardSprints, setBoardSprints] = useState<Sprint[]>(sprints);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  useEffect(() => {
    setBoardSprints(sprints);
  }, [sprints]);

  const activeSprint = isKanban ? undefined : boardSprints.find((s) => s.status === "ACTIVE");

  const handleSprintUpdated = (updated: Sprint) => {
    setBoardSprints((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    );
  };

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

  // Pick up cards moved in another tab or by someone else.
  useRefetchOnFocus(async () => {
    const fresh = await getBoardIssues(project.id, activeSprint?.id);
    if (Array.isArray(fresh)) setIssues(fresh as unknown as Issue[]);
  });

  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  const boardUnreleasedDoneIssueIds = useMemo(() => {
    return issues
      .filter((i) => isDoneStatus(i.status, statuses) && !i.versionId)
      .map((i) => i.id);
  }, [issues, statuses]);

  // Grouping / Swimlane state
  const [groupBy, setGroupBy] = useState<SwimlaneGroupBy>("NONE");
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});

  // Mobile column switcher state & scroll synchronization
  const [activeMobileColumn, setActiveMobileColumn] = useState<string>(() => COLUMNS[0]?.id || "");
  const columnRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const boardContainerRef = React.useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = React.useRef(false);
  const programmaticScrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const scrollRafId = React.useRef<number | null>(null);

  useEffect(() => {
    if (
      COLUMNS.length > 0 &&
      (!activeMobileColumn || !COLUMNS.some((c) => c.id === activeMobileColumn))
    ) {
      setActiveMobileColumn(COLUMNS[0].id);
    }
  }, [COLUMNS, activeMobileColumn]);

  // Keep active mobile tab pill scrolled into view in the top tab bar
  useEffect(() => {
    if (activeMobileColumn && tabRefs.current[activeMobileColumn]) {
      tabRefs.current[activeMobileColumn]?.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    }
  }, [activeMobileColumn]);

  // Clean up animation frames and timers on unmount
  useEffect(() => {
    return () => {
      if (scrollRafId.current) {
        cancelAnimationFrame(scrollRafId.current);
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  const scrollToColumn = (colId: string) => {
    setActiveMobileColumn(colId);
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 600);

    const el = columnRefs.current[colId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const updateActiveColumnFromScroll = () => {
    const container = boardContainerRef.current;
    if (!container || isProgrammaticScrollRef.current) return;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width > 0) {
      const containerCenter = containerRect.left + containerRect.width / 2;
      let closestColId = "";
      let minDistance = Infinity;

      for (const col of COLUMNS) {
        const el = columnRefs.current[col.id];
        if (!el) continue;
        const colRect = el.getBoundingClientRect();
        const colCenter = colRect.left + colRect.width / 2;
        const distance = Math.abs(containerCenter - colCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestColId = col.id;
        }
      }

      if (closestColId && closestColId !== activeMobileColumn) {
        setActiveMobileColumn(closestColId);
      }
      return;
    }

    // Fallback based on scrollLeft + offsetLeft
    const scrollCenter = container.scrollLeft + container.clientWidth / 2;
    let closestColId = "";
    let minDistance = Infinity;

    for (const col of COLUMNS) {
      const el = columnRefs.current[col.id];
      if (!el) continue;
      const colCenter = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(scrollCenter - colCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestColId = col.id;
      }
    }

    if (closestColId && closestColId !== activeMobileColumn) {
      setActiveMobileColumn(closestColId);
    }
  };

  const handleBoardScroll = () => {
    if (scrollRafId.current) {
      cancelAnimationFrame(scrollRafId.current);
    }
    scrollRafId.current = requestAnimationFrame(() => {
      updateActiveColumnFromScroll();
    });
  };

  const handleUserInteraction = () => {
    isProgrammaticScrollRef.current = false;
  };

  // Sync issues if initialIssues prop updates
  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Handle jira:issue-created custom event
  useEffect(() => {
    const handleIssueCreatedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ issue?: Issue }>;
      const newIssue = customEvent.detail?.issue;
      if (!newIssue || newIssue.projectId !== project.id) return;
      setIssues((prev) => {
        if (prev.some((i) => i.id === newIssue.id)) return prev;
        return [newIssue, ...prev];
      });
    };

    window.addEventListener("trackr:issue-created", handleIssueCreatedEvent);
    return () => {
      window.removeEventListener("trackr:issue-created", handleIssueCreatedEvent);
    };
  }, [project.id]);

  const handleCloseDetailModal = () => setActiveIssue(null);

  // Filters: chips for people, type and priority, plus "only mine".
  const [filters, setFilters] = useState<BoardFilterState>(NO_BOARD_FILTERS);
  const { toast } = useToast();

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

  const progress = useMemo(() => sprintProgress(sprintIssues, statuses), [sprintIssues, statuses]);

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

      return matchesBoardFilters(issue, filters, currentUser?.id);
    });
  }, [
    issues,
    activeSprint,
    searchQuery,
    filters,
    currentUser,
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

  // The lane an issue sits in under the current grouping.
  const laneOf = (issue: Issue): string => {
    if (groupBy === "ASSIGNEE") return issue.assigneeId ?? "UNASSIGNED";
    if (groupBy === "EPIC") return issue.parentId ?? "NO_EPIC";
    if (groupBy === "PRIORITY") return issue.priority;
    return "ALL";
  };

  /**
   * Moves a card to a cell (lane and status) at a position: what a drop, the
   * keyboard drag and the card's menu all come down to. Moving between lanes
   * changes the field the lanes group by.
   */
  const moveIssue = async (issueId: string, srcLaneId: string, dest: { laneId: string; status: IssueStatus }, destIndex: number) => {
    if (!permissions.canMoveIssue) return;
    const targetIssue = issues.find((i) => i.id === issueId);
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

    if (groupBy === "ASSIGNEE" && dest.laneId !== srcLaneId) {
      const newAssigneeId = dest.laneId === "UNASSIGNED" ? null : dest.laneId;
      extraData.assigneeId = newAssigneeId;
      updatedAssignee = newAssigneeId ? users.find((u) => u.id === newAssigneeId) || null : null;
    } else if (groupBy === "EPIC" && dest.laneId !== srcLaneId) {
      const newParentId = dest.laneId === "NO_EPIC" ? null : dest.laneId;
      extraData.parentId = newParentId;
      updatedParent = newParentId ? epics.find((e) => e.id === newParentId) || null : null;
    } else if (groupBy === "PRIORITY" && dest.laneId !== srcLaneId) {
      const newPriority = dest.laneId as PriorityLevel;
      extraData.priority = newPriority;
      updatedPriority = newPriority;
    }

    // Target cell items (excluding moved issue)
    const targetCellIssues = getCellIssues(dest.laneId, dest.status).filter((i) => i.id !== issueId);
    const index = Math.max(0, Math.min(destIndex, targetCellIssues.length));

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
    targetCellIssues.splice(index, 0, updatedTargetIssue);

    // Reassign contiguous order indexes to target cell items
    const orderMap = new Map<string, number>();
    targetCellIssues.forEach((item, idx) => {
      orderMap.set(item.id, idx);
    });

    // Update global issues state deterministically
    setIssues((prevIssues) =>
      prevIssues.map((item) => {
        if (orderMap.has(item.id)) {
          if (item.id === issueId) {
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
      issueId,
      dest.status,
      index,
      currentUser?.id,
      extraData,
      targetCellIssues.map((item) => item.id)
    );

    if (res.success && res.issue) {
      const serverIssue = res.issue as unknown as Issue;
      setIssues((prev) => prev.map((i) => (i.id === serverIssue.id ? { ...i, ...serverIssue } : i)));
    } else if (!res.success) {
      setIssues(previousIssues);
      toast({ title: `Couldn't move ${targetIssue.key}`, description: res.error, tone: "danger" });
    }
    return res.success;
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const src = parseDroppableId(source.droppableId);
    const dest = parseDroppableId(destination.droppableId);
    await moveIssue(draggableId, src.laneId, dest, destination.index);
  };

  const columnTitle = (statusId: string) => COLUMNS.find((c) => c.id === statusId)?.title ?? prettifyStatusName(statusId);

  // What a card's menu offers: the columns the workflow allows, and the top or
  // bottom of its own column.
  const moveOptions = (issue: Issue, index: number, cellSize: number): CardMoveOptions => {
    const lane = laneOf(issue);
    return {
      targets: moveTargets(issue.status, COLUMNS, statuses, transitions),
      onMove: async (statusId) => {
        const ok = await moveIssue(issue.id, lane, { laneId: lane, status: statusId }, getCellIssues(lane, statusId).length);
        if (ok) toast({ title: `Moved ${issue.key} to ${columnTitle(statusId)}`, tone: "success", duration: 2500 });
      },
      onMoveToEdge: (edge) => moveIssue(issue.id, lane, { laneId: lane, status: issue.status }, edge === "top" ? 0 : cellSize - 1),
      canMoveUp: index > 0,
      canMoveDown: index < cellSize - 1,
    };
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

  // Columns share the width equally from md up, never narrower than a
  // readable card: four fit at 1280 px, and only boards with more scroll.
  const gridStyle = { gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))` };
  const tql = boardFiltersToTQL(project.key, filters, { sprintOnly: !!activeSprint });
  const moreFiltersHref = `/projects/${encodeURIComponent(project.key)}/issues?tql=${encodeURIComponent(tql)}`;

  const headerActions =
    (activeSprint && permissions.canManageSprints) || permissions.canManageVersions || !isKanban ? (
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={activeSprint ? "Sprint actions" : "Board actions"} icon={<MoreHorizontal />} size="sm" />
        </MenuTrigger>
        <MenuContent align="end">
          {activeSprint && permissions.canManageSprints && (
            <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => setEditingSprint(activeSprint)}>
              Edit sprint
            </MenuItem>
          )}
          {permissions.canManageVersions && (
            <MenuItem icon={<Rocket aria-hidden="true" />} onSelect={() => setIsReleaseModalOpen(true)}>
              Create a release…
            </MenuItem>
          )}
          {!isKanban && (
            <MenuItem icon={<ListTodo aria-hidden="true" />} onSelect={() => router.push(`/projects/${project.key}/backlog`)}>
              Go to the backlog
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
    ) : null;

  const laneIdentity = (lane: Swimlane) => {
    if (groupBy === "ASSIGNEE") {
      return (
        <>
          {lane.user ? (
            <UserAvatar user={lane.user} size="xs" />
          ) : (
            <span aria-hidden="true" className="h-5 w-5 rounded-full border border-dashed border-strong" />
          )}
          <span className="truncate">{lane.title}</span>
        </>
      );
    }
    if (groupBy === "EPIC") {
      return (
        <>
          {lane.id !== "NO_EPIC" && <IssueTypeIcon type="EPIC" className="h-4 w-4 shrink-0" />}
          <span className="truncate">{lane.title}</span>
        </>
      );
    }
    return (
      <>
        {lane.priority && <PriorityIcon priority={lane.priority as PriorityLevel} className="h-4 w-4 shrink-0" />}
        <span className="truncate">{lane.title}</span>
      </>
    );
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-page px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="flex shrink-0 flex-col">
        {activeSprint ? (
          <SprintHeader sprint={activeSprint} progress={progress} actions={headerActions} />
        ) : (
          <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-ink">Board</h1>
            {isKanban ? (
              <span className="text-xs text-ink-2">
                {filteredIssues.length} {filteredIssues.length === 1 ? "issue" : "issues"}
              </span>
            ) : (
              <span className="text-xs text-ink-2">
                No active sprint.{" "}
                <Link prefetch={false} href={`/projects/${project.key}/backlog`} className="font-medium text-accent hover:underline">
                  Start one from the backlog
                </Link>
              </span>
            )}
            {headerActions && <div className="ml-auto">{headerActions}</div>}
          </div>
        )}

        <BoardFilters
          users={users}
          filters={filters}
          onChange={setFilters}
          groupBy={groupBy}
          onSelectGroupBy={setGroupBy}
          moreFiltersHref={moreFiltersHref}
        />

        {/* Phones: one column at a time, with a switcher */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar" role="group" aria-label="Columns">
          {COLUMNS.map((col) => {
            const count = filteredIssues.filter((i) => i.status === col.id).length;
            const isActive = activeMobileColumn === col.id;
            return (
              <button
                key={col.id}
                ref={(el) => {
                  tabRefs.current[col.id] = el;
                }}
                type="button"
                aria-pressed={isActive}
                onClick={() => scrollToColumn(col.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors",
                  isActive ? "border-accent/40 bg-accent-soft text-accent" : "border-subtle bg-surface text-ink-2"
                )}
              >
                <span>{col.title}</span>
                <span className="font-mono text-[11px]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={boardContainerRef}
        onScroll={handleBoardScroll}
        onTouchStart={handleUserInteraction}
        onMouseDown={handleUserInteraction}
        onWheel={handleUserInteraction}
        className="relative flex-1 snap-x snap-mandatory overflow-auto scroll-smooth pb-3 md:snap-none"
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          {groupBy === "NONE" ? (
            <div className="flex h-full min-w-max items-start gap-3 md:grid md:min-w-0" style={gridStyle}>
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  id={col.id}
                  columnRef={(el) => {
                    columnRefs.current[col.id] = el;
                  }}
                  title={col.title}
                  color={col.color}
                  wipLimit={col.wipLimit}
                  issues={getCellIssues("ALL", col.id)}
                  onIssueClick={(issue) => setActiveIssue(issue)}
                  doneStatusNames={doneStatusNames}
                  onSelectEpic={handleOpenEpic}
                  canMove={permissions.canMoveIssue}
                  moveOptions={moveOptions}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-w-max flex-col gap-3 md:min-w-0">
              {/* Column headings, once, above every lane */}
              <div className="sticky top-0 z-10 flex gap-3 bg-page pb-1 md:grid" style={gridStyle}>
                {COLUMNS.map((col) => {
                  const total = swimlanes.reduce((acc, lane) => acc + getCellIssues(lane.id, col.id).length, 0);
                  return (
                    <div
                      key={col.id}
                      ref={(el) => {
                        columnRefs.current[col.id] = el;
                      }}
                      className="flex h-9 w-[calc(100vw-1.5rem)] shrink-0 snap-center snap-always sm:w-[calc(100vw-3rem)] items-center justify-between gap-2 rounded-card bg-surface-sunk px-3 md:w-auto md:max-w-none md:min-w-0"
                    >
                      <h3 className="min-w-0">
                        <ColumnTitle title={col.title} color={col.color} />
                      </h3>
                      <ColumnCount count={total} limit={col.wipLimit} />
                    </div>
                  );
                })}
              </div>

              {swimlanes.map((lane) => {
                const isCollapsed = collapsedLanes[lane.id];
                const laneIssueCount = COLUMNS.reduce((acc, col) => acc + getCellIssues(lane.id, col.id).length, 0);
                return (
                  <section key={lane.id} aria-label={lane.title} className="rounded-card border border-subtle bg-surface">
                    <div className="flex h-10 items-center gap-2 px-2">
                      <button
                        type="button"
                        onClick={() => toggleLaneCollapse(lane.id)}
                        aria-expanded={!isCollapsed}
                        className="flex min-w-0 items-center gap-2 rounded-control px-1.5 py-1 text-[13px] font-medium text-ink hover:bg-surface-sunk"
                      >
                        {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
                        {laneIdentity(lane)}
                        <span className="font-mono text-[11px] font-normal text-ink-2">{laneIssueCount}</span>
                      </button>
                      {groupBy === "EPIC" && lane.id !== "NO_EPIC" && (
                        <button type="button" onClick={() => handleOpenEpic(lane.id)} className="ml-auto rounded-control px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
                          Open epic
                        </button>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="flex items-start gap-3 px-2 pb-2 md:grid" style={gridStyle}>
                        {COLUMNS.map((col) => (
                          <KanbanColumn
                            key={`${lane.id}::${col.id}`}
                            id={col.id}
                            droppableId={`${lane.id}::${col.id}`}
                            title={col.title}
                            wipLimit={col.wipLimit}
                            showHeader={false}
                            minHeightClass="min-h-[88px]"
                            issues={getCellIssues(lane.id, col.id)}
                            onIssueClick={(issue) => setActiveIssue(issue)}
                            doneStatusNames={doneStatusNames}
                            onSelectEpic={handleOpenEpic}
                            canMove={permissions.canMoveIssue}
                            moveOptions={moveOptions}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </DragDropContext>
      </div>

      {/* Modals */}
      <IssuePanel
        issue={activeIssue}
        issues={[...epics, ...issues]}
        users={users}
        sprints={sprints}
        versions={versions}
        epics={epics}
        project={project}
        onClose={handleCloseDetailModal}
        onIssueUpdated={handleIssueUpdated}
        onIssueDeleted={handleIssueDeleted}
      />

      {isCreateModalOpen && (
        <CreateIssueModal
          project={project}
          users={users}
          sprints={sprints}
          versions={versions}
          epics={epics}
          onClose={() => setIsCreateModalOpen(false)}
          onIssueCreated={handleIssueCreated}
        />
      )}

      {/* Edit Sprint Modal */}
      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          isOpen={!!editingSprint}
          onClose={() => setEditingSprint(null)}
          onSprintUpdated={handleSprintUpdated}
        />
      )}

      {/* Release / Fix Version Modal */}
      {isReleaseModalOpen && (
        <CreateVersionModal
          projectId={project.id}
          initialSelectedIssueIds={boardUnreleasedDoneIssueIds}
          isOpen={isReleaseModalOpen}
          onClose={() => setIsReleaseModalOpen(false)}
          onSaved={() => {
            setIsReleaseModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
