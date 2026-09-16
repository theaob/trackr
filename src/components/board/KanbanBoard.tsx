"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Project, Issue, User, IssueStatus, IssueType, PriorityLevel, Sprint } from "@/types";
import KanbanColumn from "./KanbanColumn";
import BoardFilters from "./BoardFilters";
import IssueDetailModal from "@/components/issues/IssueDetailModal";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import { updateIssueStatusAndOrder, getIssueByKeyOrId } from "@/lib/actions/issues";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { Zap, Play, CheckCircle } from "lucide-react";
import Link from "next/link";

interface KanbanBoardProps {
  project: Project;
  initialIssues: Issue[];
  users: User[];
  sprints: Sprint[];
  searchQuery?: string;
  initialSelectedIssueKey?: string;
}

const COLUMNS: { id: IssueStatus; title: string; wipLimit?: number }[] = [
  { id: "TODO", title: "To Do" },
  { id: "IN_PROGRESS", title: "In Progress", wipLimit: 4 },
  { id: "IN_REVIEW", title: "In Review", wipLimit: 3 },
  { id: "DONE", title: "Done" },
];

export default function KanbanBoard({
  project,
  initialIssues,
  users,
  sprints,
  searchQuery: propSearchQuery,
  initialSelectedIssueKey,
}: KanbanBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedIssueKey =
    searchParams?.get("selectedIssue") || searchParams?.get("issue") || initialSelectedIssueKey;

  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(project);
  const { searchQuery: contextSearchQuery } = useSearch();
  const searchQuery = propSearchQuery ?? contextSearchQuery;
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Active Sprint
  const activeSprint = sprints.find((s) => s.status === "ACTIVE");

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

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Only show issues for active sprint or unassigned to sprint if no active sprint
      if (activeSprint) {
        if (issue.sprintId !== activeSprint.id) return false;
      } else {
        // If no active sprint, show non-backlog issues
        if (issue.status === "BACKLOG") return false;
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
  ]);

  // Handle Drag & Drop
  const handleDragEnd = async (result: DropResult) => {
    if (!permissions.canMoveIssue) {
      return;
    }

    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStatus = source.droppableId as IssueStatus;
    const destStatus = destination.droppableId as IssueStatus;

    // Optimistic Update
    const updatedIssues = Array.from(issues);
    const movedIndex = updatedIssues.findIndex((i) => i.id === draggableId);
    if (movedIndex === -1) return;

    const [movedIssue] = updatedIssues.splice(movedIndex, 1);
    const updatedMovedIssue = {
      ...movedIssue,
      status: destStatus,
    };

    // Reinsert
    updatedIssues.splice(destination.index, 0, updatedMovedIssue);
    setIssues(updatedIssues);

    // Persist via Server Action
    await updateIssueStatusAndOrder(
      draggableId,
      destStatus,
      destination.index,
      currentUser?.id
    );
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

  // Group issues by column status
  const issuesByColumn = useMemo(() => {
    const map: Record<IssueStatus, Issue[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    filteredIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      }
    });
    return map;
  }, [filteredIssues]);

  // Epics list for parent selectors
  const epics = useMemo(() => issues.filter((i) => i.type === "EPIC"), [issues]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden px-6 pt-5 bg-white">
      {/* Board Header & Sprint Info */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-jira-navy tracking-tight">
              {activeSprint ? activeSprint.name : "Kanban Board"}
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
            {activeSprint && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Active Sprint
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!activeSprint && (
              <Link
                href={`/projects/${project.key}/backlog`}
                className="text-xs bg-jira-blue-light text-jira-blue font-semibold px-3 py-1.5 rounded hover:bg-jira-blue hover:text-white transition-colors"
              >
                Go to Backlog to start a sprint
              </Link>
            )}
          </div>
        </div>

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
          onlyMyIssues={onlyMyIssues}
          onToggleOnlyMyIssues={() => setOnlyMyIssues(!onlyMyIssues)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden py-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex items-start gap-4 h-full min-w-max pb-2">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                wipLimit={col.wipLimit}
                issues={issuesByColumn[col.id] || []}
                onIssueClick={(issue) => setActiveIssue(issue)}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Modals */}
      {activeIssue && (
        <IssueDetailModal
          issue={activeIssue}
          users={users}
          allIssues={issues}
          sprints={sprints}
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
