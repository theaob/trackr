"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Project, Issue, User, Sprint, IssueType, WorkflowStatus, Version } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";

import IssueDetailModal from "@/components/issues/IssueDetailModal";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import BacklogContextMenu from "@/components/backlog/BacklogContextMenu";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { createSprint, startSprint, completeSprint, moveIssueToSprint, reorderBacklogIssue, renameSprint, deleteSprint } from "@/lib/actions/sprints";
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
  Pencil,
  Trash2,
  X,
  CalendarClock,
  Bookmark,
  ExternalLink,
  Target,
} from "lucide-react";
import EditSprintModal from "@/components/sprints/EditSprintModal";
import { isOverdue } from "@/lib/dueDate";
import { isDoneStatus, getDoneStatusNames } from "@/lib/workflowDisplay";
import { format } from "date-fns";

interface BacklogViewProps {
  project: Project;
  initialIssues: Issue[];
  users: User[];
  initialSprints: Sprint[];
  versions?: Version[];
  statuses: WorkflowStatus[];
  searchQuery?: string;
  initialSelectedIssueKey?: string;
  initialEpics?: Issue[];
}

export default function BacklogView({
  project,
  initialIssues,
  users,
  initialSprints,
  versions = [],
  statuses,
  searchQuery: propSearchQuery,
  initialSelectedIssueKey,
  initialEpics,
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
  const [epics, setEpics] = useState<Issue[]>(() => {
    if (initialEpics && initialEpics.length > 0) return initialEpics;
    return initialIssues.filter((i) => i.type === "EPIC");
  });
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [selectedEpicId, setSelectedEpicId] = useState<string>("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    issue: Issue;
  } | null>(null);

  useEffect(() => {
    if (initialEpics) {
      setEpics(initialEpics);
    }
  }, [initialEpics]);

  const handleOpenEpic = (epicIdOrKey: string) => {
    const found =
      epics.find(
        (i) => i.id === epicIdOrKey || i.key.toUpperCase() === epicIdOrKey.toUpperCase()
      ) ||
      issues.find(
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

  // Rename Sprint
  const [renamingSprintId, setRenamingSprintId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete Sprint
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);

  // Edit Sprint
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  const handleSprintUpdated = (updatedSprint: Sprint) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === updatedSprint.id ? { ...s, ...updatedSprint } : s))
    );
  };

  // Sprint dropdown menu
  const [sprintMenuOpenId, setSprintMenuOpenId] = useState<string | null>(null);

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

  const handleRenameSprint = async (sprintId: string) => {
    if (!renameValue.trim()) return;
    const previous = sprints;
    const newName = renameValue.trim();
    setRenamingSprintId(null);
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, name: newName } : s))
    );

    const res = await renameSprint(sprintId, newName);
    if (!res.success) {
      setSprints(previous);
      alert(res.error || "Failed to rename sprint.");
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    const res = await deleteSprint(sprintId);
    if (res.success) {
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
      // Move issues back to backlog in local state
      setIssues((prev) =>
        prev.map((i) =>
          i.sprintId === sprintId ? { ...i, sprintId: null, status: primaryBacklogStatusName } : i
        )
      );
    } else if (res.error) {
      alert(res.error);
    }
    setDeletingSprintId(null);
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!i.key.toLowerCase().includes(q) && !i.title.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedEpicId !== "ALL") {
        if (i.parentId !== selectedEpicId && i.id !== selectedEpicId) {
          return false;
        }
      }
      return true;
    });
  }, [issues, searchQuery, selectedEpicId]);

  // Kanban has no sprint planning: just the flat Backlog list below.
  const isKanban = project.boardType === "KANBAN";

  // Check if filtering is active (reordering is paused when search or epic filters are on)
  const isFiltered = Boolean(searchQuery.trim() || selectedEpicId !== "ALL");

  const sortIssuesByOrder = (a: Issue, b: Issue) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  };

  // The project's own backlog/initial status names, not a fixed literal.
  const backlogStatusNames = useMemo(
    () => statuses.filter((s) => s.isBacklog).map((s) => s.name),
    [statuses]
  );
  const primaryBacklogStatusName = backlogStatusNames[0] ?? "BACKLOG";
  const initialStatusName = useMemo(
    () => statuses.find((s) => !s.isBacklog)?.name ?? "TODO",
    [statuses]
  );
  const doneStatusNames = useMemo(() => {
    return getDoneStatusNames(statuses);
  }, [statuses]);

  // Sprints & Backlog groupings
  const activeSprints = useMemo(() => sprints.filter((s) => s.status === "ACTIVE"), [sprints]);
  const futureSprints = useMemo(() => sprints.filter((s) => s.status === "FUTURE"), [sprints]);
  const backlogIssues = useMemo(
    () =>
      filteredIssues
        .filter((i) => i.type !== "EPIC" && !i.sprintId && backlogStatusNames.includes(i.status))
        .sort(sortIssuesByOrder),
    [filteredIssues, backlogStatusNames]
  );

  const getSprintIssues = (sprintId: string) => {
    return filteredIssues
      .filter((i) => i.type !== "EPIC" && i.sprintId === sprintId)
      .sort(sortIssuesByOrder);
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
          if (i.sprintId === completingSprint.id && !isDoneStatus(i.status, statuses)) {
            return {
              ...i,
              sprintId: incompleteMoveTarget || null,
              status: incompleteMoveTarget ? i.status : primaryBacklogStatusName,
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
    // Prevent moving epics to sprints or moving items to finished sprints
    if (targetSprintId) {
      const movedIssue = issues.find((i) => i.id === issueId);
      if (movedIssue?.type === "EPIC") {
        return;
      }
      const targetSprint = sprints.find((s) => s.id === targetSprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    const targetIssue = issues.find((i) => i.id === issueId);
    if (!targetIssue) return;

    const newStatus = targetSprintId
      ? targetIssue.status === primaryBacklogStatusName
        ? initialStatusName
        : targetIssue.status
      : primaryBacklogStatusName;

    const destContainerIssues = targetSprintId
      ? [...getSprintIssues(targetSprintId)]
      : [...backlogIssues];

    const destFiltered = destContainerIssues.filter((i) => i.id !== issueId);
    const updatedIssue: Issue = {
      ...targetIssue,
      sprintId: targetSprintId,
      status: newStatus,
      order: destFiltered.length,
    };
    destFiltered.push(updatedIssue);

    const destOrderMap = new Map<string, number>();
    destFiltered.forEach((item, idx) => {
      destOrderMap.set(item.id, idx);
    });

    const previousIssues = issues;
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === issueId) {
          return updatedIssue;
        }
        if (destOrderMap.has(i.id)) {
          return { ...i, order: destOrderMap.get(i.id)! };
        }
        return i;
      })
    );

    const res = await reorderBacklogIssue(
      issueId,
      targetSprintId,
      destFiltered.length - 1,
      destFiltered.map((i) => i.id)
    );
    if (!res.success) {
      setIssues(previousIssues);
      if (res.error) alert(res.error);
    }
  };

  // Move Issue to Top or Bottom of Current Container
  const handleReorderEdge = async (issueId: string, position: "top" | "bottom") => {
    if (!permissions.canMoveIssue || isFiltered) return;
    const targetIssue = issues.find((i) => i.id === issueId);
    if (!targetIssue) return;

    const isBacklogItem = !targetIssue.sprintId;
    const containerIssues = isBacklogItem
      ? [...backlogIssues]
      : [...getSprintIssues(targetIssue.sprintId!)];

    if (containerIssues.length <= 1) return;

    const remaining = containerIssues.filter((i) => i.id !== issueId);
    const reordered =
      position === "top" ? [targetIssue, ...remaining] : [...remaining, targetIssue];

    const orderMap = new Map<string, number>();
    reordered.forEach((item, idx) => {
      orderMap.set(item.id, idx);
    });

    const previousIssues = issues;
    setIssues((prev) =>
      prev.map((i) => {
        if (orderMap.has(i.id)) {
          return { ...i, order: orderMap.get(i.id)! };
        }
        return i;
      })
    );

    const targetIndex = position === "top" ? 0 : reordered.length - 1;
    const res = await reorderBacklogIssue(
      issueId,
      targetIssue.sprintId,
      targetIndex,
      reordered.map((i) => i.id)
    );

    if (!res.success) {
      setIssues(previousIssues);
      if (res.error) alert(res.error);
    }
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result: DropResult) => {
    if (!permissions.canMoveIssue || isFiltered) {
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

    const draggedIssue = issues.find((i) => i.id === draggableId);
    if (!draggedIssue) return;

    // Prevent dragging epics into sprints or dragging into finished sprints
    if (targetSprintId) {
      if (draggedIssue.type === "EPIC") {
        return;
      }
      const targetSprint = sprints.find((s) => s.id === targetSprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    const previousIssues = issues;

    // Case 1: Reorder within the same container
    if (source.droppableId === destination.droppableId) {
      const containerIssues =
        destination.droppableId === "backlog"
          ? [...backlogIssues]
          : [...getSprintIssues(destination.droppableId)];

      const reordered = Array.from(containerIssues);
      const [moved] = reordered.splice(source.index, 1);
      if (!moved) return;
      reordered.splice(destination.index, 0, moved);

      const orderMap = new Map<string, number>();
      reordered.forEach((item, idx) => {
        orderMap.set(item.id, idx);
      });

      setIssues((prev) =>
        prev.map((i) => {
          if (orderMap.has(i.id)) {
            return { ...i, order: orderMap.get(i.id)! };
          }
          return i;
        })
      );

      const res = await reorderBacklogIssue(
        draggableId,
        targetSprintId,
        destination.index,
        reordered.map((i) => i.id)
      );

      if (!res.success) {
        setIssues(previousIssues);
        if (res.error) alert(res.error);
      }
      return;
    }

    // Case 2: Moving across containers (Backlog <-> Sprint, or Sprint A <-> Sprint B)
    const newStatus = targetSprintId
      ? draggedIssue.status === primaryBacklogStatusName
        ? initialStatusName
        : draggedIssue.status
      : primaryBacklogStatusName;

    const destContainerIssues =
      destination.droppableId === "backlog"
        ? [...backlogIssues]
        : [...getSprintIssues(destination.droppableId)];

    const destFiltered = destContainerIssues.filter((i) => i.id !== draggableId);
    const updatedDraggedIssue: Issue = {
      ...draggedIssue,
      sprintId: targetSprintId,
      status: newStatus,
    };

    destFiltered.splice(destination.index, 0, updatedDraggedIssue);

    const destOrderMap = new Map<string, number>();
    destFiltered.forEach((item, idx) => {
      destOrderMap.set(item.id, idx);
    });

    const sourceContainerIssues =
      source.droppableId === "backlog"
        ? [...backlogIssues]
        : [...getSprintIssues(source.droppableId)];
    const sourceFiltered = sourceContainerIssues.filter((i) => i.id !== draggableId);
    const sourceOrderMap = new Map<string, number>();
    sourceFiltered.forEach((item, idx) => {
      sourceOrderMap.set(item.id, idx);
    });

    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === draggableId) {
          return {
            ...updatedDraggedIssue,
            order: destination.index,
          };
        }
        if (destOrderMap.has(i.id)) {
          return { ...i, order: destOrderMap.get(i.id)! };
        }
        if (sourceOrderMap.has(i.id)) {
          return { ...i, order: sourceOrderMap.get(i.id)! };
        }
        return i;
      })
    );

    const res = await reorderBacklogIssue(
      draggableId,
      targetSprintId,
      destination.index,
      destFiltered.map((i) => i.id)
    );

    if (!res.success) {
      setIssues(previousIssues);
      if (res.error) alert(res.error);
    }
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

    const titleText = inlineTitle.trim();
    const tempId = `temp-${Date.now()}`;
    const initialStatus = sprintId ? initialStatusName : primaryBacklogStatusName;

    // Determine max order among all existing issues in the target container
    const containerIssues = issues.filter((i) => {
      if (i.type === "EPIC") return false;
      if (sprintId) return i.sprintId === sprintId;
      return !i.sprintId && backlogStatusNames.includes(i.status);
    });

    const maxOrder = containerIssues.reduce(
      (max, item) => Math.max(max, item.order ?? 0),
      -1
    );
    const nextOrder = maxOrder + 1;

    // Optimistic issue object
    const optimisticIssue: Issue = {
      id: tempId,
      key: `${project.key}-...`,
      title: titleText,
      description: null,
      status: initialStatus,
      priority: "MEDIUM",
      type: inlineType,
      storyPoints: null,
      originalEstimateSeconds: null,
      remainingEstimateSeconds: null,
      dueDate: null,
      startDate: null,
      projectId: project.id,
      sprintId: sprintId,
      parentId: null,
      versionId: null,
      reporterId: currentUser?.id || null,
      reporter: currentUser || null,
      assigneeId: null,
      assignee: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      order: nextOrder,
      labels: [],
      comments: [],
      attachments: [],
      components: [],
      worklogs: [],
    };

    // Show card immediately and clear input
    setIssues((prev) => [...prev, optimisticIssue]);
    setInlineTitle("");
    setInlineCreateTarget(null);

    const res = await createIssue({
      projectId: project.id,
      title: titleText,
      type: inlineType,
      sprintId: sprintId,
      status: initialStatus,
      order: nextOrder,
      reporterId: currentUser?.id,
    });

    if (res.success && res.issue) {
      // Replace optimistic card with real database record
      setIssues((prev) =>
        prev.map((i) => (i.id === tempId ? (res.issue as Issue) : i))
      );
    } else {
      // Rollback on failure and restore input
      setIssues((prev) => prev.filter((i) => i.id !== tempId));
      setInlineCreateTarget(sprintId);
      setInlineTitle(titleText);
      alert(res.error || "Failed to create issue.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-3 sm:px-6 py-3 sm:py-5 bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-jira-gray-200 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-jira-navy tracking-tight">Backlog</h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
          </div>
          <p className="text-xs text-jira-gray-600 mt-0.5">
            {isKanban
              ? "Groom and prioritize work before it's pulled onto the board."
              : "Plan sprints, groom user stories, and estimate points."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {epics.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-jira-gray-500 font-medium">Epic:</span>
              <select
                value={selectedEpicId}
                onChange={(e) => setSelectedEpicId(e.target.value)}
                className="bg-jira-gray-100 hover:bg-jira-gray-200 border border-jira-gray-300 rounded px-2.5 py-1 text-xs text-jira-navy font-semibold outline-none focus:border-jira-blue transition-colors max-w-[160px] truncate"
              >
                <option value="ALL">All Epics</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.key}: {epic.title}
                  </option>
                ))}
              </select>
              {selectedEpicId !== "ALL" && (
                <button
                  type="button"
                  onClick={() => handleOpenEpic(selectedEpicId)}
                  className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline flex items-center gap-1"
                  title="View epic details and linked issues"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {!isKanban && permissions.canManageSprints && (
            <button
              onClick={handleCreateSprint}
              className="bg-jira-gray-100 hover:bg-jira-gray-200 text-jira-navy text-xs font-semibold px-3 py-1.5 rounded border border-jira-gray-300 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Sprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Sprints & Backlog Drag-and-Drop Container */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="py-5 space-y-6">
          {/* Active and Future Sprints */}
          {!isKanban && [...activeSprints, ...futureSprints].map((sprint) => {
            const sprintIssues = getSprintIssues(sprint.id);
            const totalPoints = sprintIssues.reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0);
            const donePoints = sprintIssues
              .filter((i) => isDoneStatus(i.status, statuses))
              .reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0);
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

                    {renamingSprintId === sprint.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRenameSprint(sprint.id);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSprint(sprint.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenamingSprintId(null);
                          }}
                          className="text-sm font-bold text-jira-navy bg-white border border-jira-blue rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-jira-blue/30 w-48"
                        />
                      </form>
                    ) : (
                      <h3 className="text-sm font-bold text-jira-navy">{sprint.name}</h3>
                    )}

                    {sprint.status === "ACTIVE" && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    )}

                    <span className="text-xs text-jira-gray-500 font-medium">
                      ({sprintIssues.length} issues)
                    </span>

                    {isFiltered && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                        title="Manual reordering is disabled while search or filters are active"
                      >
                        Filtered (Reorder paused)
                      </span>
                    )}

                    {sprint.startDate && sprint.endDate ? (
                      <button
                        type="button"
                        disabled={!permissions.canManageSprints}
                        onClick={() => permissions.canManageSprints && setEditingSprint(sprint)}
                        className={`text-xs text-jira-gray-500 flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded transition-colors ${
                          permissions.canManageSprints ? "hover:bg-jira-gray-200 hover:text-jira-navy cursor-pointer" : ""
                        }`}
                        title={permissions.canManageSprints ? "Edit sprint dates" : undefined}
                      >
                        <Calendar className="w-3.5 h-3.5 text-jira-gray-400" />
                        <span>
                          {format(new Date(sprint.startDate), "MMM d")} - {format(new Date(sprint.endDate), "MMM d")}
                        </span>
                      </button>
                    ) : permissions.canManageSprints ? (
                      <button
                        type="button"
                        onClick={() => setEditingSprint(sprint)}
                        className="text-[11px] text-jira-blue hover:underline flex items-center gap-1 ml-2 font-medium"
                        title="Add dates to sprint"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Add dates</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Right side: Story Points, Actions */}
                  <div className="flex items-center gap-3">
                    {/* Story Points Badges */}
                    <div className="flex items-center gap-1 text-xs">
                      <span
                        title="Estimated points"
                        className="px-2 py-0.5 rounded-full bg-jira-gray-200 text-jira-gray-800 font-bold text-[11px]"
                      >
                        {totalPoints} pts
                      </span>
                      {(sprint.status === "ACTIVE" || donePoints > 0) && (
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

                    {/* Sprint Actions Menu */}
                    {permissions.canManageSprints && (
                      <div className="relative">
                        <button
                          onClick={() => setSprintMenuOpenId(sprintMenuOpenId === sprint.id ? null : sprint.id)}
                          className="p-1.5 hover:bg-jira-gray-200 rounded text-jira-gray-500 hover:text-jira-gray-700 transition-colors"
                          title="Sprint actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {sprintMenuOpenId === sprint.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-jira-gray-300 rounded-md shadow-lg py-1 z-50 animate-in fade-in">
                            <button
                              onClick={() => {
                                setEditingSprint(sprint);
                                setSprintMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-jira-navy hover:bg-jira-gray-100 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-jira-gray-500" />
                              <span>Edit Sprint</span>
                            </button>
                            {sprint.status !== "ACTIVE" && (
                              <button
                                onClick={() => {
                                  setDeletingSprintId(sprint.id);
                                  setSprintMenuOpenId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Sprint</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sprint Goal / Target Subheader */}
                {sprint.goal && (
                  <div className="px-4 py-1.5 bg-jira-gray-50 border-b border-jira-gray-200 flex items-center justify-between gap-2 text-xs">
                    <div
                      onClick={() => permissions.canManageSprints && setEditingSprint(sprint)}
                      className={`flex items-center gap-2 text-jira-gray-600 overflow-hidden ${
                        permissions.canManageSprints ? "hover:text-jira-navy cursor-pointer group/goal" : ""
                      }`}
                      title={permissions.canManageSprints ? "Click to edit sprint goal" : undefined}
                    >
                      <Target className="w-3.5 h-3.5 text-jira-blue shrink-0" />
                      <span className="font-semibold text-jira-gray-700 shrink-0">Goal:</span>
                      <span className="truncate italic text-jira-gray-700">{sprint.goal}</span>
                      {permissions.canManageSprints && (
                        <Pencil className="w-3 h-3 text-jira-gray-400 opacity-0 group-hover/goal:opacity-100 transition-opacity shrink-0" />
                      )}
                    </div>
                  </div>
                )}

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
                          <Draggable
                            key={issue.id}
                            draggableId={issue.id}
                            index={index}
                            isDragDisabled={!permissions.canMoveIssue || isFiltered}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={() => setActiveIssue(issue)}
                                onContextMenu={(e) => handleContextMenu(e, issue)}
                                className={`px-3 sm:px-4 py-2.5 bg-white hover:bg-jira-gray-50 flex items-center justify-between gap-4 cursor-pointer transition-colors group ${
                                  dragSnapshot.isDragging ? "shadow-lg ring-2 ring-jira-blue bg-white z-50 opacity-95" : ""
                                }`}
                              >
                                {/* Mobile Issue Row (< sm) */}
                                <div className="w-full sm:hidden flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        {...dragProvided.dragHandleProps}
                                        className={`p-0.5 text-jira-gray-400 shrink-0 ${
                                          permissions.canMoveIssue && !isFiltered
                                            ? "hover:text-jira-gray-700 cursor-grab active:cursor-grabbing"
                                            : "cursor-default opacity-40"
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                        title={
                                          !permissions.canMoveIssue
                                            ? undefined
                                            : isFiltered
                                            ? "Reordering is disabled while search or filters are active"
                                            : "Drag to reorder"
                                        }
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </div>
                                      <IssueTypeBadge type={issue.type} size="xs" />
                                      <span className="text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue shrink-0">
                                        {issue.key}
                                      </span>
                                      {issue.parent && (
                                        <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.2 rounded truncate max-w-[100px]">
                                          {issue.parent.title}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <StatusBadge status={issue.status} className="text-[10px]" />
                                      {issue.assignee ? (
                                        <UserAvatar user={issue.assignee} size="xs" />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full border border-dashed border-jira-gray-300" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleContextMenu(e, issue);
                                        }}
                                        className="p-1 text-jira-gray-400 hover:text-jira-gray-700 hover:bg-jira-gray-100 rounded transition-colors"
                                        title="More actions"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pl-5">
                                    <span className="text-xs font-medium text-jira-navy truncate flex-1">
                                      {issue.title}
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
                                      {issue.storyPoints !== null && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[10px] font-bold">
                                          {issue.storyPoints}
                                        </span>
                                      )}
                                      {issue.dueDate && (
                                        <span
                                          className={`text-[10px] font-semibold ${
                                            isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                              ? "text-rose-600"
                                              : "text-jira-gray-500"
                                          }`}
                                        >
                                          {format(new Date(issue.dueDate), "MMM d")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Desktop Issue Row (>= sm) */}
                                <div className="hidden sm:flex items-center justify-between gap-4 w-full">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className={`p-0.5 text-jira-gray-400 shrink-0 ${
                                        permissions.canMoveIssue && !isFiltered
                                          ? "hover:text-jira-gray-700 cursor-grab active:cursor-grabbing"
                                          : "cursor-default opacity-40"
                                      }`}
                                      onClick={(e) => e.stopPropagation()}
                                      title={
                                        !permissions.canMoveIssue
                                          ? undefined
                                          : isFiltered
                                          ? "Reordering is disabled while search or filters are active"
                                          : "Drag to reorder or move between sprints/backlog"
                                      }
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>

                                    {/* The icon-only badge is a fixed size, so the key
                                        column starts at the same x on every row. */}
                                    <IssueTypeBadge type={issue.type} size="xs" />
                                    <span className="min-w-[88px] shrink-0 text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue">
                                      {issue.key}
                                    </span>

                                    <span className="text-sm font-medium text-jira-navy truncate">
                                      {issue.title}
                                    </span>
                                    {issue.parent && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEpic(issue.parent!.id);
                                        }}
                                        className="text-[10px] bg-purple-100 text-purple-800 hover:bg-purple-200 font-semibold px-1.5 py-0.5 rounded shrink-0 max-w-[150px] truncate transition-colors text-left"
                                        title={`Epic: ${issue.parent.title} (${issue.parent.key})`}
                                      >
                                        {issue.parent.title}
                                      </button>
                                    )}
                                    {issue.version && (
                                      <span
                                        className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-medium px-1.5 py-0.5 rounded shrink-0 max-w-[120px] truncate"
                                        title={`Fix Version: ${issue.version.name}`}
                                      >
                                        {issue.version.name}
                                      </span>
                                    )}
                                    {issue.labels && issue.labels.length > 0 && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {issue.labels.slice(0, 2).map((il) => (
                                          <span
                                            key={il.id}
                                            className="text-[10px] bg-jira-gray-100 border border-jira-gray-300 text-jira-gray-700 font-medium px-1.5 py-0.5 rounded-full"
                                          >
                                            {il.label.name}
                                          </span>
                                        ))}
                                        {issue.labels.length > 2 && (
                                          <span className="text-[10px] text-jira-gray-400">
                                            +{issue.labels.length - 2}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {issue.dueDate && (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                                          isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                            ? "text-rose-600"
                                            : "text-jira-gray-500"
                                        }`}
                                        title={`Due ${format(new Date(issue.dueDate), "MMM d, yyyy")}`}
                                      >
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        {format(new Date(issue.dueDate), "MMM d")}
                                      </span>
                                    )}

                                    {/* Status Column */}
                                    <div className="w-28 flex items-center justify-center shrink-0">
                                      <StatusBadge status={issue.status} className="w-full text-center" />
                                    </div>

                                    {/* Priority Column */}
                                    <div className="w-6 flex items-center justify-center shrink-0">
                                      <PriorityIcon priority={issue.priority} className="w-4 h-4" />
                                    </div>

                                    {/* Story Points Column */}
                                    <div className="w-7 flex items-center justify-center shrink-0">
                                      {issue.storyPoints !== null ? (
                                        <span className="w-6 h-5 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[11px] font-bold flex items-center justify-center">
                                          {issue.storyPoints}
                                        </span>
                                      ) : (
                                        <span className="w-6 h-5 rounded-full bg-jira-gray-100 text-jira-gray-400 text-[11px] font-medium flex items-center justify-center select-none">
                                          -
                                        </span>
                                      )}
                                    </div>

                                    {/* Assignee Avatar Column */}
                                    <div className="w-7 flex items-center justify-center shrink-0">
                                      {issue.assignee ? (
                                        <UserAvatar
                                          user={issue.assignee}
                                          size="sm"
                                          showTooltip
                                          tooltipPrefix="Assignee"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full border border-dashed border-jira-gray-300" />
                                      )}
                                    </div>

                                    {/* Row actions menu trigger */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleContextMenu(e, issue);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-jira-gray-200 rounded text-jira-gray-400 hover:text-jira-gray-700 transition-opacity shrink-0"
                                      title="More actions"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
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
                        {permissions.canCreateIssue && (
                          inlineCreateTarget === sprint.id ? (
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
                          )
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
                {isFiltered && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                    title="Manual reordering is disabled while search or filters are active"
                  >
                    Filtered (Reorder paused)
                  </span>
                )}
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
                    <Draggable
                      key={issue.id}
                      draggableId={issue.id}
                      index={index}
                      isDragDisabled={!permissions.canMoveIssue || isFiltered}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          onClick={() => setActiveIssue(issue)}
                          onContextMenu={(e) => handleContextMenu(e, issue)}
                          className={`px-3 sm:px-4 py-2.5 bg-white hover:bg-jira-gray-50 flex items-center justify-between gap-4 cursor-pointer transition-colors group ${
                            dragSnapshot.isDragging ? "shadow-lg ring-2 ring-jira-blue bg-white z-50 opacity-95" : ""
                          }`}
                        >
                          {/* Mobile Issue Row (< sm) */}
                          <div className="w-full sm:hidden flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className={`p-0.5 text-jira-gray-400 shrink-0 ${
                                    permissions.canMoveIssue && !isFiltered
                                      ? "hover:text-jira-gray-700 cursor-grab active:cursor-grabbing"
                                      : "cursor-default opacity-40"
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={
                                    !permissions.canMoveIssue
                                      ? undefined
                                      : isFiltered
                                      ? "Reordering is disabled while search or filters are active"
                                      : "Drag to reorder"
                                  }
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <IssueTypeBadge type={issue.type} size="xs" />
                                <span className="text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue shrink-0">
                                  {issue.key}
                                </span>
                                {issue.parent && (
                                  <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.2 rounded truncate max-w-[100px]">
                                    {issue.parent.title}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={issue.status} className="text-[10px]" />
                                {issue.assignee ? (
                                  <UserAvatar user={issue.assignee} size="xs" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border border-dashed border-jira-gray-300" />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleContextMenu(e, issue);
                                  }}
                                  className="p-1 text-jira-gray-400 hover:text-jira-gray-700 hover:bg-jira-gray-100 rounded transition-colors"
                                  title="More actions"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pl-5">
                              <span className="text-xs font-medium text-jira-navy truncate flex-1">
                                {issue.title}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
                                {issue.storyPoints !== null && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[10px] font-bold">
                                    {issue.storyPoints}
                                  </span>
                                )}
                                {issue.dueDate && (
                                  <span
                                    className={`text-[10px] font-semibold ${
                                      isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                        ? "text-rose-600"
                                        : "text-jira-gray-500"
                                    }`}
                                  >
                                    {format(new Date(issue.dueDate), "MMM d")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Desktop Issue Row (>= sm) */}
                          <div className="hidden sm:flex items-center justify-between gap-4 w-full">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                {...dragProvided.dragHandleProps}
                                className={`p-0.5 text-jira-gray-400 shrink-0 ${
                                  permissions.canMoveIssue && !isFiltered
                                    ? "hover:text-jira-gray-700 cursor-grab active:cursor-grabbing"
                                    : "cursor-default opacity-40"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                                title={
                                  !permissions.canMoveIssue
                                    ? undefined
                                    : isFiltered
                                    ? "Reordering is disabled while search or filters are active"
                                    : "Drag to sprint or reorder"
                                }
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>

                              <IssueTypeBadge type={issue.type} size="xs" />
                              <span className="min-w-[88px] shrink-0 text-xs font-bold text-jira-gray-600 group-hover:text-jira-blue">
                                {issue.key}
                              </span>

                              <span className="text-sm font-medium text-jira-navy truncate">
                                {issue.title}
                              </span>
                              {issue.parent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEpic(issue.parent!.id);
                                  }}
                                  className="text-[10px] bg-purple-100 text-purple-800 hover:bg-purple-200 font-semibold px-1.5 py-0.5 rounded shrink-0 max-w-[150px] truncate transition-colors text-left"
                                  title={`Epic: ${issue.parent.title} (${issue.parent.key})`}
                                >
                                  {issue.parent.title}
                                </button>
                              )}
                              {issue.version && (
                                <span
                                  className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-medium px-1.5 py-0.5 rounded shrink-0 max-w-[120px] truncate"
                                  title={`Fix Version: ${issue.version.name}`}
                                >
                                  {issue.version.name}
                                </span>
                              )}
                              {issue.labels && issue.labels.length > 0 && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {issue.labels.slice(0, 2).map((il) => (
                                    <span
                                      key={il.id}
                                      className="text-[10px] bg-jira-gray-100 border border-jira-gray-300 text-jira-gray-700 font-medium px-1.5 py-0.5 rounded-full"
                                    >
                                      {il.label.name}
                                    </span>
                                  ))}
                                  {issue.labels.length > 2 && (
                                    <span className="text-[10px] text-jira-gray-400">
                                      +{issue.labels.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {issue.dueDate && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                                    isOverdue(issue.dueDate, issue.status, doneStatusNames)
                                      ? "text-rose-600"
                                      : "text-jira-gray-500"
                                  }`}
                                  title={`Due ${format(new Date(issue.dueDate), "MMM d, yyyy")}`}
                                >
                                  <CalendarClock className="w-3.5 h-3.5" />
                                  {format(new Date(issue.dueDate), "MMM d")}
                                </span>
                              )}

                              {/* Status Column */}
                              <div className="w-28 flex items-center justify-center shrink-0">
                                <StatusBadge status={issue.status} className="w-full text-center" />
                              </div>

                              {/* Priority Column */}
                              <div className="w-6 flex items-center justify-center shrink-0">
                                <PriorityIcon priority={issue.priority} className="w-4 h-4" />
                              </div>

                              {/* Story Points Column */}
                              <div className="w-7 flex items-center justify-center shrink-0">
                                {issue.storyPoints !== null ? (
                                  <span className="w-6 h-5 rounded-full bg-jira-gray-200 text-jira-gray-800 text-[11px] font-bold flex items-center justify-center">
                                    {issue.storyPoints}
                                  </span>
                                ) : (
                                  <span className="w-6 h-5 rounded-full bg-jira-gray-100 text-jira-gray-400 text-[11px] font-medium flex items-center justify-center select-none">
                                    -
                                  </span>
                                )}
                              </div>

                              {/* Assignee Avatar Column */}
                              <div className="w-7 flex items-center justify-center shrink-0">
                                {issue.assignee ? (
                                  <UserAvatar
                                    user={issue.assignee}
                                    size="sm"
                                    showTooltip
                                    tooltipPrefix="Assignee"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full border border-dashed border-jira-gray-300" />
                                )}
                              </div>

                              {/* Row actions menu trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContextMenu(e, issue);
                                }}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-jira-gray-200 rounded text-jira-gray-400 hover:text-jira-gray-700 transition-opacity shrink-0"
                                title="More actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
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
                  {permissions.canCreateIssue && (
                    inlineCreateTarget === "backlog" ? (
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
                    )
                  )}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>

      {/* Delete Sprint Confirmation */}
      {deletingSprintId && (() => {
        const sprintToDelete = sprints.find((s) => s.id === deletingSprintId);
        const issueCount = sprintToDelete ? getSprintIssues(sprintToDelete.id).length : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-jira-gray-300 p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold">Delete Sprint</h3>
              </div>
              <p className="text-sm text-jira-gray-700">
                Are you sure you want to delete <strong>{sprintToDelete?.name}</strong>?
                {issueCount > 0 && (
                  <span className="block mt-1 text-jira-gray-500">
                    {issueCount} issue{issueCount > 1 ? "s" : ""} will be moved to the backlog.
                  </span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingSprintId(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-jira-gray-700 hover:bg-jira-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSprint(deletingSprintId)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
          isKanban={isKanban}
          canMove={permissions.canMoveIssue}
          onClose={() => setContextMenu(null)}
          onMoveToSprint={handleMoveIssue}
          onOpenIssue={(issue) => setActiveIssue(issue)}
          onReorder={isFiltered ? undefined : handleReorderEdge}
        />
      )}

      {/* Issue Details Modal */}
      {activeIssue && (
        <IssueDetailModal
          issue={activeIssue}
          users={users}
          allIssues={[...epics, ...issues]}
          sprints={sprints}
          versions={versions}
          project={project}
          onActiveIssueChange={(newIssue) => setActiveIssue(newIssue)}
          onClose={handleCloseDetailModal}
          onIssueUpdated={(up) => {
            setIssues((prev) => prev.map((i) => (i.id === up.id ? up : i)));
            if (up.type === "EPIC") {
              setEpics((prev) => {
                const exists = prev.some((e) => e.id === up.id);
                return exists ? prev.map((e) => (e.id === up.id ? up : e)) : [up, ...prev];
              });
            }
            setActiveIssue(up);
          }}
          onIssueDeleted={(id) => {
            setIssues((prev) => prev.filter((i) => i.id !== id));
            setEpics((prev) => prev.filter((e) => e.id !== id));
            setActiveIssue(null);
          }}
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
    </div>
  );
}
