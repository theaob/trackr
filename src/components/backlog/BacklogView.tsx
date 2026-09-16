"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Project, Issue, User, Sprint, IssueType } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";

import IssueDetailModal from "@/components/issues/IssueDetailModal";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import BacklogContextMenu from "@/components/backlog/BacklogContextMenu";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { createSprint, startSprint, completeSprint, moveIssueToSprint } from "@/lib/actions/sprints";
import { createIssue, getIssueByKeyOrId } from "@/lib/actions/issues";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Play,
  CheckCircle2,
  Calendar,
  MoreHorizontal,
  Layers,
  ArrowRight,
  GripVertical,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface BacklogViewProps {
  project: Project;
  initialIssues: Issue[];
  users: User[];
  initialSprints: Sprint[];
  searchQuery?: string;
  initialSelectedIssueKey?: string;
}

export default function BacklogView({
  project,
  initialIssues,
  users,
  initialSprints,
  searchQuery: propSearchQuery,
  initialSelectedIssueKey,
}: BacklogViewProps) {
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
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    issue: Issue;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      issue,
    });
  };

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

  // Collapsed states
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  // Inline issue creation
  const [inlineCreateTarget, setInlineCreateTarget] = useState<string | null>(null); // sprintId or 'backlog'
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineType, setInlineType] = useState<IssueType>("STORY");

  // Start Sprint Modal
  const [startingSprint, setStartingSprint] = useState<Sprint | null>(null);
  const [sprintName, setSprintName] = useState("");
  const [durationMode, setDurationMode] = useState<string>("14"); // "7" | "14" | "21" | "28" | "custom"
  const [customDays, setCustomDays] = useState<number>(14);
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");
  const [sprintGoal, setSprintGoal] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const openStartSprintModal = (sprint: Sprint) => {
    setStartingSprint(sprint);
    setSprintName(sprint.name);
    setSprintGoal(sprint.goal || "");
    setDurationMode("14");
    setCustomDays(14);
    setDateError(null);
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    setStartDateStr(format(now, "yyyy-MM-dd"));
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleDurationChange = (mode: string) => {
    setDurationMode(mode);
    setDateError(null);
    const baseStart = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
    if (mode === "custom") {
      const end = new Date(baseStart.getTime() + customDays * 24 * 60 * 60 * 1000);
      setEndDateStr(format(end, "yyyy-MM-dd"));
    } else {
      const days = parseInt(mode, 10);
      setCustomDays(days);
      const end = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);
      setEndDateStr(format(end, "yyyy-MM-dd"));
    }
  };

  const handleCustomDaysChange = (days: number) => {
    const validDays = Math.max(1, Math.min(365, days));
    setCustomDays(validDays);
    setDurationMode("custom");
    setDateError(null);
    const baseStart = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
    const end = new Date(baseStart.getTime() + validDays * 24 * 60 * 60 * 1000);
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDateStr(newStart);
    setDateError(null);
    if (!newStart) return;
    const start = new Date(newStart + "T00:00:00");
    const days = durationMode === "custom" ? customDays : parseInt(durationMode, 10);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDateStr(newEnd);
    if (!startDateStr || !newEnd) return;
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(newEnd + "T00:00:00");
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      setDateError("End date must be after start date");
    } else {
      setDateError(null);
      setCustomDays(diffDays);
      if (diffDays === 7 || diffDays === 14 || diffDays === 21 || diffDays === 28) {
        setDurationMode(String(diffDays));
      } else {
        setDurationMode("custom");
      }
    }
  };

  // Complete Sprint Modal
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [incompleteMoveTarget, setIncompleteMoveTarget] = useState<string>("");

  const toggleSprintCollapse = (id: string) => {
    setCollapsedSprints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const q = searchQuery.toLowerCase();
    return issues.filter(
      (i) => i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)
    );
  }, [issues, searchQuery]);

  // Sprints & Backlog groupings
  const activeSprints = useMemo(() => sprints.filter((s) => s.status === "ACTIVE"), [sprints]);
  const futureSprints = useMemo(() => sprints.filter((s) => s.status === "FUTURE"), [sprints]);
  const backlogIssues = useMemo(
    () => filteredIssues.filter((i) => !i.sprintId && i.status === "BACKLOG"),
    [filteredIssues]
  );

  const getSprintIssues = (sprintId: string) => {
    return filteredIssues.filter((i) => i.sprintId === sprintId);
  };

  // Create Sprint Action
  const handleCreateSprint = async () => {
    const nextNum = sprints.length + 1;
    const res = await createSprint(project.id, `Sprint ${nextNum}`);
    if (res.success && res.sprint) {
      setSprints([res.sprint as Sprint, ...sprints]);
    }
  };

  // Start Sprint Action
  const handleStartSprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startingSprint) return;

    if (!startDateStr || !endDateStr) {
      setDateError("Please specify both start and end dates");
      return;
    }

    const startDate = new Date(startDateStr + "T00:00:00");
    const endDate = new Date(endDateStr + "T23:59:59");

    if (endDate.getTime() <= startDate.getTime()) {
      setDateError("End date must be after start date");
      return;
    }

    const res = await startSprint(startingSprint.id, {
      name: sprintName,
      startDate,
      endDate,
      goal: sprintGoal,
    });

    if (res.success && res.sprint) {
      setSprints((prev) =>
        prev.map((s) => (s.id === startingSprint.id ? (res.sprint as Sprint) : s))
      );
      setStartingSprint(null);
    } else if (res.error) {
      setDateError(res.error);
    }
  };

  // Complete Sprint Action
  const handleCompleteSprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingSprint) return;

    const res = await completeSprint(completingSprint.id, incompleteMoveTarget || null);
    if (res.success) {
      setSprints((prev) =>
        prev.map((s) => (s.id === completingSprint.id ? { ...s, status: "COMPLETED" } : s))
      );

      // Move issues in local state
      setIssues((prev) =>
        prev.map((i) => {
          if (i.sprintId === completingSprint.id && i.status !== "DONE") {
            return {
              ...i,
              sprintId: incompleteMoveTarget || null,
              status: incompleteMoveTarget ? i.status : "BACKLOG",
            };
          }
          return i;
        })
      );

      setCompletingSprint(null);
    }
  };

  // Move Issue Sprint
  const handleMoveIssue = async (issueId: string, targetSprintId: string | null) => {
    // Prevent moving items to finished sprints
    if (targetSprintId) {
      const targetSprint = sprints.find((s) => s.id === targetSprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    // Optimistic UI update
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              sprintId: targetSprintId,
              status: targetSprintId ? (i.status === "BACKLOG" ? "TODO" : i.status) : "BACKLOG",
            }
          : i
      )
    );

    const res = await moveIssueToSprint(issueId, targetSprintId);
    if (!res.success) {
      setIssues(initialIssues);
    }
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result: DropResult) => {
    if (!permissions.canMoveIssue) {
      return;
    }

    const { source, destination, draggableId } = result;
    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const targetSprintId =
      destination.droppableId === "backlog" ? null : destination.droppableId;

    // Prevent dragging into finished sprints
    if (targetSprintId) {
      const targetSprint = sprints.find((s) => s.id === targetSprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    // Optimistic UI update
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === draggableId) {
          const newStatus = targetSprintId
            ? i.status === "BACKLOG"
              ? "TODO"
              : i.status
            : "BACKLOG";
          return {
            ...i,
            sprintId: targetSprintId,
            status: newStatus,
          };
        }
        return i;
      })
    );

    await moveIssueToSprint(draggableId, targetSprintId);
  };

  // Inline Quick Create Issue
  const handleInlineCreate = async (sprintId: string | null) => {
    if (!inlineTitle.trim()) return;

    // Prevent creating in finished sprints
    if (sprintId) {
      const targetSprint = sprints.find((s) => s.id === sprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    const res = await createIssue({
      projectId: project.id,
      title: inlineTitle.trim(),
      type: inlineType,
      sprintId: sprintId,
      status: sprintId ? "TODO" : "BACKLOG",
      reporterId: currentUser?.id,
    });

    if (res.success && res.issue) {
      setIssues([res.issue as Issue, ...issues]);
      setInlineTitle("");
      setInlineCreateTarget(null);
    }
  };

  // Epics
  const epics = useMemo(() => issues.filter((i) => i.type === "EPIC"), [issues]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-6 py-5 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-jira-gray-200 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-jira-navy tracking-tight">Backlog</h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
          </div>
          <p className="text-xs text-jira-gray-600 mt-0.5">
            Plan sprints, groom user stories, and estimate points.
          </p>
        </div>

        {permissions.canManageSprints && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateSprint}
              className="bg-jira-gray-100 hover:bg-jira-gray-200 text-jira-navy text-xs font-semibold px-3 py-1.5 rounded border border-jira-gray-300 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Sprint</span>
            </button>
          </div>
        )}
      </div>

      {/* Sprints & Backlog Drag-and-Drop Container */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="py-5 space-y-6">
          {/* Active and Future Sprints */}
          {[...activeSprints, ...futureSprints].map((sprint) => {
            const sprintIssues = getSprintIssues(sprint.id);
            const totalPoints = sprintIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
            const donePoints = sprintIssues
              .filter((i) => i.status === "DONE")
              .reduce((sum, i) => sum + (i.storyPoints || 0), 0);
            const isCollapsed = collapsedSprints[sprint.id];

            return (
              <div
                key={sprint.id}
                className="bg-jira-gray-50/70 border border-jira-gray-300 rounded-lg overflow-hidden shadow-xs"
              >
                {/* Sprint Header */}
                <div className="px-4 py-3 bg-jira-gray-100 border-b border-jira-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSprintCollapse(sprint.id)}
                      className="p-1 hover:bg-jira-gray-200 rounded text-jira-gray-600"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <h3 className="text-sm font-bold text-jira-navy">{sprint.name}</h3>

                    {sprint.status === "ACTIVE" && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    )}

                    <span className="text-xs text-jira-gray-500 font-medium">
                      ({sprintIssues.length} issues)
                    </span>

                    {sprint.startDate && sprint.endDate && (
                      <span className="text-xs text-jira-gray-500 flex items-center gap-1 ml-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(sprint.startDate), "MMM d")} - {format(new Date(sprint.endDate), "MMM d")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Story Points Badges */}
                    <div className="flex items-center gap-1 text-xs">
                      <span
                        title="Estimated points"
                        className="px-2 py-0.5 rounded-full bg-jira-gray-200 text-jira-gray-800 font-bold text-[11px]"
                      >
                        {totalPoints} pts
                      </span>
                      {sprint.status === "ACTIVE" && (
                        <span
                          title="Completed points"
                          className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]"
                        >
                          {donePoints} done
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {permissions.canManageSprints && sprint.status === "FUTURE" && (
                      <button
                        onClick={() => openStartSprintModal(sprint)}
                        className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        <span>Start Sprint</span>
                      </button>
                    )}

                    {permissions.canManageSprints && sprint.status === "ACTIVE" && (
                      <button
                        onClick={() => setCompletingSprint(sprint)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete Sprint</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sprint Content */}
                {!isCollapsed && (
                  <Droppable droppableId={sprint.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`divide-y divide-jira-gray-200 transition-colors ${
                          snapshot.isDraggingOver ? "bg-blue-50/60 ring-2 ring-jira-blue/40 ring-inset" : ""
                        }`}
                      >
                        {sprintIssues.map((issue, index) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={() => setActiveIssue(issue)}
                                onContextMenu={(e) => handleContextMenu(e, issue)}
                                className={`px-4 py-2.5 bg-white hover:bg-jira-gray-50 flex items-center justify-between gap-4 cursor-pointer transition-colors group ${
                                  dragSnapshot.isDragging ? "shadow-lg ring-2 ring-jira-blue bg-white z-50 opacity-95" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="p-0.5 text-jira-gray-400 hover:text-jira-gray-700 cursor-grab active:cursor-grabbing shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Drag to reorder or move between sprints/backlog"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>

                                  <IssueTypeBadge type={issue.type} size="xs" />
                                  <span className="text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue">
                                    {issue.key}
                                  </span>

                                  <span className="text-sm font-medium text-jira-navy truncate">
                                    {issue.title}
                                  </span>
                                  {issue.parent && (
                                    <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded shrink-0">
                                      {issue.parent.title}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                  <StatusBadge status={issue.status} />
                                  <PriorityIcon priority={issue.priority} className="w-4 h-4" />

                                  {issue.storyPoints !== null && (
                                    <span className="w-6 h-5 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[11px] font-bold flex items-center justify-center">
                                      {issue.storyPoints}
                                    </span>
                                  )}

                                  {issue.assignee ? (
                                    issue.assignee.avatarUrl ? (
                                      <img
                                        src={issue.assignee.avatarUrl}
                                        alt={issue.assignee.name}
                                        title={issue.assignee.name}
                                        className="w-6 h-6 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-jira-blue text-white text-[10px] font-bold flex items-center justify-center">
                                        {issue.assignee.name.charAt(0)}
                                      </div>
                                    )
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border border-dashed border-jira-gray-300" />
                                  )}

                                  {/* Move to another sprint or backlog */}
                                  <div className="relative">
                                    <select
                                      value={issue.sprintId || ""}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleMoveIssue(issue.id, e.target.value || null);
                                      }}
                                      className="text-[11px] bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 rounded px-2 py-0.5 text-jira-navy font-medium outline-none cursor-pointer"
                                    >
                                      <option value={issue.sprintId || ""}>Move to...</option>
                                      <option value="">Backlog</option>
                                      {sprints
                                        .filter((s) => s.status !== "COMPLETED" || s.id === issue.sprintId)
                                        .map((s) => (
                                          <option
                                            key={s.id}
                                            value={s.id}
                                            disabled={s.id === issue.sprintId || s.status === "COMPLETED"}
                                          >
                                            {s.name} {s.status === "ACTIVE" ? "(Active)" : s.status === "FUTURE" ? "(Planned)" : "(Completed - Closed)"}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {sprintIssues.length === 0 && !snapshot.isDraggingOver && (
                          <div className="px-4 py-5 text-center text-xs text-jira-gray-400 italic">
                            Sprint is empty. Drag issues here or create an issue below.
                          </div>
                        )}

                        {/* Inline Create Row */}
                        {inlineCreateTarget === sprint.id ? (
                          <div className="p-3 bg-white flex items-center gap-2">
                            <select
                              value={inlineType}
                              onChange={(e) => setInlineType(e.target.value as IssueType)}
                              className="text-xs border border-jira-gray-300 rounded px-2 py-1.5"
                            >
                              <option value="STORY">Story</option>
                              <option value="TASK">Task</option>
                              <option value="BUG">Bug</option>
                            </select>
                            <input
                              type="text"
                              placeholder="What needs to be done?"
                              value={inlineTitle}
                              onChange={(e) => setInlineTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineCreate(sprint.id);
                                if (e.key === "Escape") setInlineCreateTarget(null);
                              }}
                              autoFocus
                              className="flex-1 text-sm border border-jira-gray-300 rounded px-3 py-1.5 focus:border-jira-blue outline-none"
                            />
                            <button
                              onClick={() => handleInlineCreate(sprint.id)}
                              className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover"
                            >
                              Create
                            </button>
                            <button
                              onClick={() => setInlineCreateTarget(null)}
                              className="text-xs text-jira-gray-600 hover:bg-jira-gray-100 px-2 py-1.5 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setInlineCreateTarget(sprint.id);
                              setInlineTitle("");
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-50 flex items-center gap-2 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create issue</span>
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>
            );
          })}

          {/* Backlog Section */}
          <div className="bg-jira-gray-50/70 border border-jira-gray-300 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-jira-gray-100 border-b border-jira-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-jira-navy">Backlog</h3>
                <span className="text-xs text-jira-gray-500 font-medium">
                  ({backlogIssues.length} issues)
                </span>
              </div>
            </div>

            <Droppable droppableId="backlog">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`divide-y divide-jira-gray-200 transition-colors ${
                    snapshot.isDraggingOver ? "bg-blue-50/60 ring-2 ring-jira-blue/40 ring-inset" : ""
                  }`}
                >
                  {backlogIssues.map((issue, index) => (
                    <Draggable key={issue.id} draggableId={issue.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          onClick={() => setActiveIssue(issue)}
                          onContextMenu={(e) => handleContextMenu(e, issue)}
                          className={`px-4 py-2.5 bg-white hover:bg-jira-gray-50 flex items-center justify-between gap-4 cursor-pointer transition-colors group ${
                            dragSnapshot.isDragging ? "shadow-lg ring-2 ring-jira-blue bg-white z-50 opacity-95" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              {...dragProvided.dragHandleProps}
                              className="p-0.5 text-jira-gray-400 hover:text-jira-gray-700 cursor-grab active:cursor-grabbing shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              title="Drag to sprint or reorder"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>

                            <IssueTypeBadge type={issue.type} size="xs" />
                            <span className="text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue">
                              {issue.key}
                            </span>

                            <span className="text-sm font-medium text-jira-navy truncate">
                              {issue.title}
                            </span>
                            {issue.parent && (
                              <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded shrink-0">
                                {issue.parent.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <StatusBadge status={issue.status} />
                            <PriorityIcon priority={issue.priority} className="w-4 h-4" />

                            {issue.storyPoints !== null && (
                              <span className="w-6 h-5 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[11px] font-bold flex items-center justify-center">
                                {issue.storyPoints}
                              </span>
                            )}

                            {issue.assignee ? (
                              issue.assignee.avatarUrl ? (
                                <img
                                  src={issue.assignee.avatarUrl}
                                  alt={issue.assignee.name}
                                  title={issue.assignee.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-jira-blue text-white text-[10px] font-bold flex items-center justify-center">
                                  {issue.assignee.name.charAt(0)}
                                </div>
                              )
                            ) : (
                              <div className="w-6 h-6 rounded-full border border-dashed border-jira-gray-300" />
                            )}

                            {/* Move to any Sprint (Active or Future/Unstarted) */}
                            <div className="relative">
                              <select
                                value=""
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.value) {
                                    handleMoveIssue(issue.id, e.target.value);
                                  }
                                }}
                                className="text-[11px] bg-jira-blue-light/70 hover:bg-jira-blue-light border border-jira-blue/30 text-jira-blue font-semibold rounded px-2 py-0.5 outline-none cursor-pointer"
                              >
                                <option value="">+ Add to Sprint</option>
                                {sprints
                                  .filter((s) => s.status !== "COMPLETED")
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} {s.status === "ACTIVE" ? "(Active)" : s.status === "FUTURE" ? "(Planned / Unstarted)" : ""}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {backlogIssues.length === 0 && !snapshot.isDraggingOver && (
                    <div className="px-4 py-5 text-center text-xs text-jira-gray-400 italic">
                      Backlog is empty. Drag issues here or create an issue below.
                    </div>
                  )}

                  {/* Inline Create Row for Backlog */}
                  {inlineCreateTarget === "backlog" ? (
                    <div className="p-3 bg-white flex items-center gap-2">
                      <select
                        value={inlineType}
                        onChange={(e) => setInlineType(e.target.value as IssueType)}
                        className="text-xs border border-jira-gray-300 rounded px-2 py-1.5"
                      >
                        <option value="STORY">Story</option>
                        <option value="TASK">Task</option>
                        <option value="BUG">Bug</option>
                      </select>
                      <input
                        type="text"
                        placeholder="What needs to be done?"
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInlineCreate(null);
                          if (e.key === "Escape") setInlineCreateTarget(null);
                        }}
                        autoFocus
                        className="flex-1 text-sm border border-jira-gray-300 rounded px-3 py-1.5 focus:border-jira-blue outline-none"
                      />
                      <button
                        onClick={() => handleInlineCreate(null)}
                        className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => setInlineCreateTarget(null)}
                        className="text-xs text-jira-gray-600 hover:bg-jira-gray-100 px-2 py-1.5 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setInlineCreateTarget("backlog");
                        setInlineTitle("");
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create issue in backlog</span>
                    </button>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>

      {/* Start Sprint Modal */}
      {startingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-jira-gray-300 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200">
              <h2 className="text-lg font-bold text-jira-navy flex items-center gap-2">
                <Play className="w-5 h-5 text-jira-blue fill-jira-blue/10" />
                Start Sprint
              </h2>
              <span className="text-xs text-jira-gray-500 font-medium bg-jira-gray-100 px-2 py-0.5 rounded">
                {getSprintIssues(startingSprint.id).length} issues
              </span>
            </div>

            <form onSubmit={handleStartSprintSubmit} className="space-y-4 text-sm">
              {/* Sprint Name */}
              <div>
                <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                  Sprint Name <span className="text-jira-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="Sprint Name"
                  className="w-full border border-jira-gray-300 rounded px-3 py-2 text-sm text-jira-navy outline-none focus:border-jira-blue font-medium"
                />
              </div>

              {/* Duration with Custom Option */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider">
                    Duration
                  </label>
                  {durationMode === "custom" && (
                    <span className="text-xs font-bold text-jira-blue">
                      Custom: {customDays} {customDays === 1 ? "day" : "days"}
                    </span>
                  )}
                </div>
                <select
                  value={durationMode}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="w-full border border-jira-gray-300 rounded px-3 py-2 text-sm text-jira-navy outline-none focus:border-jira-blue bg-white"
                >
                  <option value="7">1 week (7 days)</option>
                  <option value="14">2 weeks (14 days - Recommended)</option>
                  <option value="21">3 weeks (21 days)</option>
                  <option value="28">4 weeks (28 days)</option>
                  <option value="custom">Custom time span</option>
                </select>
              </div>

              {/* Custom Duration Stepper & Quick Pills */}
              {durationMode === "custom" && (
                <div className="p-3 bg-jira-blue-light/40 border border-jira-blue/20 rounded-lg space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-jira-navy flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-jira-blue" />
                      Set Custom Number of Days
                    </span>
                    <span className="text-jira-gray-600">
                      Calculates end date automatically
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={customDays}
                        onChange={(e) => handleCustomDaysChange(parseInt(e.target.value, 10) || 1)}
                        className="w-24 border border-jira-gray-300 rounded px-3 py-1.5 text-sm font-semibold text-jira-navy outline-none focus:border-jira-blue"
                      />
                      <span className="ml-2 text-xs font-medium text-jira-gray-600">
                        {customDays === 1 ? "day" : "days"}
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[3, 5, 10, 15, 30, 45].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleCustomDaysChange(d)}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            customDays === d
                              ? "bg-jira-blue text-white border-jira-blue font-semibold shadow-xs"
                              : "bg-white text-jira-gray-700 border-jira-gray-300 hover:bg-jira-gray-100"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Start Date & End Date Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full border border-jira-gray-300 rounded px-3 py-2 text-sm text-jira-navy outline-none focus:border-jira-blue"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDateStr}
                    min={startDateStr}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full border border-jira-gray-300 rounded px-3 py-2 text-sm text-jira-navy outline-none focus:border-jira-blue"
                    required
                  />
                </div>
              </div>

              {/* Date Error */}
              {dateError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-jira-red font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {/* Calculated Duration Summary Preview */}
              {startDateStr && endDateStr && !dateError && (
                <div className="px-3 py-2 bg-jira-gray-50 border border-jira-gray-200 rounded-md text-xs text-jira-gray-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-jira-gray-500" />
                    Sprint Timeline:
                  </span>
                  <span className="font-semibold text-jira-navy">
                    {customDays} {customDays === 1 ? "day" : "days"} (
                    {format(new Date(startDateStr + "T00:00:00"), "MMM d, yyyy")} – {format(new Date(endDateStr + "T00:00:00"), "MMM d, yyyy")})
                  </span>
                </div>
              )}

              {/* Sprint Goal */}
              <div>
                <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                  Sprint Goal
                </label>
                <textarea
                  rows={2}
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="What does the team aim to achieve in this sprint?"
                  className="w-full border border-jira-gray-300 rounded p-2.5 text-sm text-jira-navy outline-none focus:border-jira-blue placeholder:text-jira-gray-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-jira-gray-200">
                <button
                  type="button"
                  onClick={() => setStartingSprint(null)}
                  className="px-4 py-2 text-jira-gray-700 hover:bg-jira-gray-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-jira-blue text-white px-4 py-2 rounded text-xs font-semibold hover:bg-jira-blue-hover shadow-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white/20" />
                  <span>Start Sprint</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Sprint Modal */}
      {completingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4">
            <h2 className="text-lg font-bold text-jira-navy">Complete {completingSprint.name}</h2>
            <p className="text-xs text-jira-gray-600">
              Completed issues will be archived with this sprint. Where should incomplete issues go?
            </p>

            <form onSubmit={handleCompleteSprintSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                  Move incomplete issues to:
                </label>
                <select
                  value={incompleteMoveTarget}
                  onChange={(e) => setIncompleteMoveTarget(e.target.value)}
                  className="w-full border border-jira-gray-300 rounded px-3 py-2 text-jira-navy outline-none"
                >
                  <option value="">Backlog</option>
                  {futureSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingSprint(null)}
                  className="px-4 py-2 text-jira-gray-700 hover:bg-jira-gray-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-semibold hover:bg-emerald-700"
                >
                  Complete Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Right-Click Context Menu */}
      {contextMenu && (
        <BacklogContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          issue={contextMenu.issue}
          sprints={sprints}
          canMove={permissions.canMoveIssue}
          onClose={() => setContextMenu(null)}
          onMoveToSprint={handleMoveIssue}
          onOpenIssue={(issue) => setActiveIssue(issue)}
        />
      )}

      {/* Issue Details Modal */}
      {activeIssue && (
        <IssueDetailModal
          issue={activeIssue}
          users={users}
          allIssues={issues}
          sprints={sprints}
          onClose={handleCloseDetailModal}
          onIssueUpdated={(up) => {
            setIssues((prev) => prev.map((i) => (i.id === up.id ? up : i)));
            setActiveIssue(up);
          }}
          onIssueDeleted={(id) => {
            setIssues((prev) => prev.filter((i) => i.id !== id));
            setActiveIssue(null);
          }}
        />
      )}
    </div>
  );
}
