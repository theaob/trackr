"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Project, Issue, User, Sprint, IssueType, PriorityLevel, WorkflowStatus, Version } from "@/types";
import { PriorityIcon } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";

import IssuePanel from "@/components/issue/IssuePanel";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { createSprint, startSprint, completeSprint, reorderBacklogIssue, renameSprint, deleteSprint, getProjectSprints } from "@/lib/actions/sprints";
import { createIssue, getIssueByKeyOrId, getBacklogIssues, getProjectEpics, bulkUpdateIssues } from "@/lib/actions/issues";
import BacklogRow from "./BacklogRow";
import BacklogSection from "./BacklogSection";
import InlineCreateRow from "./InlineCreateRow";
import { Button, IconButton } from "@/components/ui/Button";
import { Combobox, Select } from "@/components/ui/Select";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { backlogMoveTargets } from "@/lib/board";
import { EMPTY_SELECTION, extendSelection, pruneSelection, toggleSelection, type SelectionState } from "@/lib/selection";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import EditSprintModal from "@/components/sprints/EditSprintModal";
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
  initialEpics,
}: BacklogViewProps) {
  const router = useRouter();

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

  useEffect(() => {
    if (initialEpics) {
      setEpics(initialEpics);
    }
  }, [initialEpics]);

  // Pick up issues and sprints changed in another tab or by someone else.
  useRefetchOnFocus(async () => {
    const [freshIssues, freshSprints, freshEpics] = await Promise.all([
      getBacklogIssues(project.id),
      getProjectSprints(project.id),
      getProjectEpics(project.id),
    ]);
    setIssues(freshIssues as unknown as Issue[]);
    setSprints(freshSprints as unknown as Sprint[]);
    setEpics(freshEpics as unknown as Issue[]);
  });

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



  // Sync issues if initialIssues prop updates
  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Issues created elsewhere (quick create, the backlog) arrive as tamam:issue-created
  useEffect(() => {
    const handleIssueCreatedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        issue?: Issue;
        source?: string;
        tempId?: string;
      }>;
      const newIssue = customEvent.detail?.issue;
      if (!newIssue || newIssue.projectId !== project.id) return;
      if (customEvent.detail?.source === "backlog-inline") return;
      setIssues((prev) => {
        if (
          customEvent.detail?.tempId &&
          prev.some((i) => i.id === customEvent.detail.tempId)
        ) {
          return prev.map((i) =>
            i.id === customEvent.detail?.tempId ? newIssue : i
          );
        }
        if (prev.some((i) => i.id === newIssue.id)) return prev;
        return [...prev, newIssue];
      });
    };

    window.addEventListener("tamam:issue-created", handleIssueCreatedEvent);
    return () => {
      window.removeEventListener("tamam:issue-created", handleIssueCreatedEvent);
    };
  }, [project.id]);

  const handleCloseDetailModal = () => setActiveIssue(null);

  // Collapsed states
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  // Selected rows, for moving or editing several at once.
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { toast } = useToast();

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
      toast({ title: res.error || "The sprint couldn't be renamed.", tone: "danger" });
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    const res = await deleteSprint(sprintId);
    if (res.success) {
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
      // Move issues back to backlog in local state; finished ones stay finished.
      setIssues((prev) =>
        prev.map((i) =>
          i.sprintId === sprintId
            ? {
                ...i,
                sprintId: null,
                status: doneStatusNames.includes(i.status) ? i.status : primaryBacklogStatusName,
              }
            : i
        )
      );
    } else if (res.error) {
      toast({ title: res.error, tone: "danger" });
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

  const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

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
      dedupeById(
        filteredIssues
          .filter(
            (i) =>
              i.type !== "EPIC" &&
              !i.sprintId &&
              backlogStatusNames.some(
                (b) => b.toLowerCase() === i.status.toLowerCase()
              )
          )
          .sort(sortIssuesByOrder)
      ),
    [filteredIssues, backlogStatusNames]
  );

  const getSprintIssues = (sprintId: string) => {
    return dedupeById(
      filteredIssues
        .filter((i) => i.type !== "EPIC" && i.sprintId === sprintId)
        .sort(sortIssuesByOrder)
    );
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
    if (issueId.startsWith("temp-")) return;

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

    const isFromBacklog = backlogStatusNames.some(
      (b) => b.toLowerCase() === targetIssue.status.toLowerCase()
    );
    const newStatus = targetSprintId
      ? isFromBacklog
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
      if (res.error) toast({ title: res.error, tone: "danger" });
    }
  };

  // Move Issue to Top or Bottom of Current Container
  const handleReorderEdge = async (issueId: string, position: "top" | "bottom") => {
    if (!permissions.canMoveIssue || isFiltered || issueId.startsWith("temp-")) return;
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
      if (res.error) toast({ title: res.error, tone: "danger" });
    }
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result: DropResult) => {
    if (!permissions.canMoveIssue || isFiltered) {
      return;
    }

    const { source, destination, draggableId } = result;
    if (!destination || draggableId.startsWith("temp-")) return;

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
        if (res.error) toast({ title: res.error, tone: "danger" });
      }
      return;
    }

    // Case 2: Moving across containers (Backlog <-> Sprint, or Sprint A <-> Sprint B)
    const isFromBacklog = backlogStatusNames.some(
      (b) => b.toLowerCase() === draggedIssue.status.toLowerCase()
    );
    const newStatus = targetSprintId
      ? isFromBacklog
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
      if (res.error) toast({ title: res.error, tone: "danger" });
    }
  };

  // Inline Quick Create Issue: resolves true once it's saved, so the row can
  // stay open for the next one.
  const createInline = async (sprintId: string | null, titleText: string, inlineType: IssueType): Promise<boolean> => {
    if (!titleText.trim()) return false;

    // Prevent creating in finished sprints
    if (sprintId) {
      const targetSprint = sprints.find((s) => s.id === sprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return false;
      }
    }

    const tempId = `temp-${Date.now()}`;
    const initialStatus = sprintId ? initialStatusName : primaryBacklogStatusName;

    // Determine max order among all existing issues in the target container
    const containerIssues = issues.filter((i) => {
      if (i.type === "EPIC") return false;
      if (sprintId) return i.sprintId === sprintId;
      return (
        !i.sprintId &&
        backlogStatusNames.some((b) => b.toLowerCase() === i.status.toLowerCase())
      );
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

    // Show the row immediately
    setIssues((prev) => [...prev, optimisticIssue]);

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
      const createdIssue = res.issue as Issue;
      // Replace optimistic card with real database record
      setIssues((prev) =>
        prev.map((i) => (i.id === tempId ? createdIssue : i))
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tamam:issue-created", {
            detail: { issue: createdIssue, source: "backlog-inline", tempId },
          })
        );
      }
      return true;
    }
    // Roll back; the row keeps what was typed.
    setIssues((prev) => prev.filter((i) => i.id !== tempId));
    toast({ title: "Couldn't create the issue", description: res.error, tone: "danger" });
    return false;
  };

  // ---- Selecting several rows ------------------------------------------------
  const visibleRowIds = useMemo(() => {
    const ids: string[] = [];
    if (!isKanban) for (const s of [...activeSprints, ...futureSprints]) ids.push(...getSprintIssues(s.id).map((i) => i.id));
    ids.push(...backlogIssues.map((i) => i.id));
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSprintIssues reads these
  }, [issues, sprints, backlogIssues, isKanban, activeSprints, futureSprints, filteredIssues]);

  useEffect(() => setSelection((prev) => pruneSelection(prev, visibleRowIds)), [visibleRowIds]);

  const selectRow = (id: string, mode: "toggle" | "range", sectionOrder: string[]) =>
    setSelection((prev) => (mode === "range" ? extendSelection(prev, id, sectionOrder) : toggleSelection(prev, id)));
  const selectedIds = [...selection.ids];
  const clearSelection = () => setSelection(EMPTY_SELECTION);

  /**
   * Moves the selected issues, in the order they're shown, to the end of a
   * sprint or the backlog. Epics stay where they are: they can't be in a sprint.
   */
  const moveSelectedTo = async (targetSprintId: string | null) => {
    const order = new Map(visibleRowIds.map((id, i) => [id, i]));
    const moving = issues
      .filter((i) => selection.ids.has(i.id) && !i.id.startsWith("temp-") && !(targetSprintId && i.type === "EPIC"))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    if (!moving.length) return;
    const movingIds = new Set(moving.map((i) => i.id));
    const staying = (targetSprintId ? getSprintIssues(targetSprintId) : backlogIssues).filter((i) => !movingIds.has(i.id));
    const finalOrder = [...staying, ...moving].map((i) => i.id);

    const previous = issues;
    setIssues((prev) =>
      prev.map((i) => {
        const at = finalOrder.indexOf(i.id);
        if (!movingIds.has(i.id)) return at >= 0 ? { ...i, order: at } : i;
        const fromBacklog = backlogStatusNames.some((b) => b.toLowerCase() === i.status.toLowerCase());
        const status = targetSprintId ? (fromBacklog ? initialStatusName : i.status) : primaryBacklogStatusName;
        return { ...i, sprintId: targetSprintId, status, order: at };
      })
    );
    setBulkBusy(true);
    let failed = 0;
    for (const issue of moving) {
      const res = await reorderBacklogIssue(issue.id, targetSprintId, finalOrder.indexOf(issue.id), finalOrder);
      if (!res.success) failed++;
    }
    setBulkBusy(false);
    const where = targetSprintId ? sprints.find((s) => s.id === targetSprintId)?.name ?? "the sprint" : "the backlog";
    if (failed) {
      setIssues(previous);
      toast({ title: `Couldn't move ${failed} of ${moving.length} issues`, tone: "danger" });
      router.refresh();
    } else {
      toast({ title: `Moved ${moving.length} ${moving.length === 1 ? "issue" : "issues"} to ${where}`, tone: "success" });
      clearSelection();
    }
  };

  const updateSelected = async (changes: { assigneeId?: string | null; priority?: PriorityLevel }, what: string) => {
    const ids = selectedIds.filter((id) => !id.startsWith("temp-"));
    if (!ids.length) return;
    const previous = issues;
    const assignee = changes.assigneeId !== undefined ? users.find((u) => u.id === changes.assigneeId) ?? null : undefined;
    setIssues((prev) =>
      prev.map((i) => (ids.includes(i.id) ? { ...i, ...changes, ...(assignee !== undefined ? { assignee } : {}) } : i))
    );
    setBulkBusy(true);
    const res = await bulkUpdateIssues(ids, changes);
    setBulkBusy(false);
    if (!res.success || res.failed.length) {
      setIssues(previous);
      toast({ title: `Couldn't change the ${what} of every issue`, description: !res.success ? res.error : res.failed[0]?.error, tone: "danger" });
      router.refresh();
      return;
    }
    toast({ title: `Changed the ${what} of ${ids.length} ${ids.length === 1 ? "issue" : "issues"}`, tone: "success" });
  };

  const statusColor = (name: string) => statuses.find((st) => st.name === name)?.color;
  const dragBlockedReason = !permissions.canMoveIssue ? null : isFiltered ? "Reordering is paused while the list is filtered" : null;
  const selectable = permissions.canMoveIssue || permissions.canEditIssue;

  const renderRows = (list: Issue[]) => {
    const order = list.map((i) => i.id);
    return list.map((issue, index) => (
      <BacklogRow
        key={issue.id}
        issue={issue}
        index={index}
        statusColor={statusColor(issue.status)}
        doneStatusNames={doneStatusNames}
        canDrag={permissions.canMoveIssue && !isFiltered && !issue.id.startsWith("temp-")}
        dragBlockedReason={dragBlockedReason}
        selectable={selectable}
        selected={selection.ids.has(issue.id)}
        onSelect={(mode) => selectRow(issue.id, mode, order)}
        onOpen={() => setActiveIssue(issue)}
        canMove={permissions.canMoveIssue}
        moveTargets={backlogMoveTargets(issue, sprints, isKanban)}
        onMove={(sprintId) => handleMoveIssue(issue.id, sprintId)}
        onReorder={isFiltered ? undefined : (edge) => handleReorderEdge(issue.id, edge)}
        canMoveUp={index > 0}
        canMoveDown={index < list.length - 1}
      />
    ));
  };

  const sprintDates = (sprint: Sprint) =>
    sprint.startDate && sprint.endDate ? (
      permissions.canManageSprints ? (
        <button type="button" onClick={() => setEditingSprint(sprint)} className="rounded-control px-1 hover:bg-surface hover:text-ink">
          {format(new Date(sprint.startDate), "MMM d")} – {format(new Date(sprint.endDate), "MMM d")}
        </button>
      ) : (
        <>
          {format(new Date(sprint.startDate), "MMM d")} – {format(new Date(sprint.endDate), "MMM d")}
        </>
      )
    ) : permissions.canManageSprints ? (
      <button type="button" onClick={() => setEditingSprint(sprint)} className="rounded-control px-1 font-medium text-accent hover:bg-accent-soft">
        Add dates
      </button>
    ) : null;

  const moveTargets = [
    ...(!isKanban ? [...activeSprints, ...futureSprints].map((sp) => ({ id: sp.id as string | null, name: sp.name })) : []),
    { id: null as string | null, name: "Backlog" },
  ];

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-page px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Backlog</h1>
          <p className="text-xs text-ink-2">
            {isKanban ? "Groom and prioritize work before it's pulled onto the board." : "Plan sprints, groom stories and estimate points."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {epics.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-48">
                <Combobox
                  aria-label="Epic"
                  options={[
                    { value: "ALL", label: "All epics" },
                    ...epics.map((epic) => ({ value: epic.id, label: epic.title, description: epic.key, keywords: epic.key })),
                  ]}
                  value={selectedEpicId}
                  onChange={setSelectedEpicId}
                  searchPlaceholder="Find an epic…"
                />
              </div>
              {selectedEpicId !== "ALL" && (
                <IconButton label="Open the epic" icon={<ExternalLink />} size="sm" onClick={() => handleOpenEpic(selectedEpicId)} />
              )}
            </div>
          )}
          {!isKanban && permissions.canManageSprints && (
            <Button size="sm" onClick={handleCreateSprint}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create sprint
            </Button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4 pb-6">
          {!isKanban &&
            [...activeSprints, ...futureSprints].map((sprint) => {
              const sprintIssues = getSprintIssues(sprint.id);
              const totalPoints = sprintIssues.reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0);
              const donePoints = sprintIssues
                .filter((i) => isDoneStatus(i.status, statuses))
                .reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0);
              const isActive = sprint.status === "ACTIVE";

              return (
                <BacklogSection
                  key={sprint.id}
                  droppableId={sprint.id}
                  name={sprint.name}
                  title={
                    renamingSprintId === sprint.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRenameSprint(sprint.id);
                        }}
                      >
                        <input
                          autoFocus
                          aria-label="Sprint name"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSprint(sprint.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenamingSprintId(null);
                          }}
                          className="h-7 w-48 rounded-control border border-accent bg-surface px-2 text-[13px] font-semibold text-ink"
                        />
                      </form>
                    ) : (
                      sprint.name
                    )
                  }
                  active={isActive}
                  dates={sprintDates(sprint)}
                  issueCount={sprintIssues.length}
                  points={{ total: totalPoints, done: isActive || donePoints > 0 ? donePoints : undefined }}
                  goal={sprint.goal}
                  reorderPaused={isFiltered}
                  collapsed={!!collapsedSprints[sprint.id]}
                  onToggleCollapsed={() => toggleSprintCollapse(sprint.id)}
                  emptyText="Nothing planned yet. Drag issues here, or create one below."
                  primaryAction={
                    permissions.canManageSprints ? (
                      isActive ? (
                        <Button size="sm" onClick={() => setCompletingSprint(sprint)}>
                          Complete sprint
                        </Button>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => openStartSprintModal(sprint)}>
                          Start sprint
                        </Button>
                      )
                    ) : undefined
                  }
                  menu={
                    permissions.canManageSprints ? (
                      <Menu>
                        <MenuTrigger asChild>
                          <IconButton label={`Actions for ${sprint.name}`} icon={<MoreHorizontal />} size="sm" />
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => setEditingSprint(sprint)}>
                            Edit sprint
                          </MenuItem>
                          <MenuItem
                            onSelect={() => {
                              setRenamingSprintId(sprint.id);
                              setRenameValue(sprint.name);
                            }}
                          >
                            Rename
                          </MenuItem>
                          {!isActive && (
                            <>
                              <MenuSeparator />
                              <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => setDeletingSprintId(sprint.id)}>
                                Delete sprint
                              </MenuItem>
                            </>
                          )}
                        </MenuContent>
                      </Menu>
                    ) : undefined
                  }
                  footer={
                    permissions.canCreateIssue ? (
                      <InlineCreateRow label={`Create an issue in ${sprint.name}`} onCreate={(title, type) => createInline(sprint.id, title, type)} />
                    ) : undefined
                  }
                >
                  {renderRows(sprintIssues)}
                </BacklogSection>
              );
            })}

          <BacklogSection
            droppableId="backlog"
            name="Backlog"
            title="Backlog"
            issueCount={backlogIssues.length}
            points={{ total: backlogIssues.reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0) }}
            reorderPaused={isFiltered}
            collapsed={!!collapsedSprints.backlog}
            onToggleCollapsed={() => toggleSprintCollapse("backlog")}
            emptyText="The backlog is empty."
            footer={
              permissions.canCreateIssue ? (
                <InlineCreateRow label="Create an issue in the backlog" onCreate={(title, type) => createInline(null, title, type)} />
              ) : undefined
            }
          >
            {renderRows(backlogIssues)}
          </BacklogSection>
        </div>
      </DragDropContext>

      {selection.ids.size > 0 && (
        <div
          role="toolbar"
          aria-label="Selected issues"
          className="sticky bottom-3 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-card border border-subtle bg-surface px-3 py-2 shadow-overlay"
        >
          <span className="px-1 text-[13px] font-medium text-ink">{selection.ids.size} selected</span>
          {permissions.canMoveIssue && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" disabled={bulkBusy}>
                  Move to…
                </Button>
              </MenuTrigger>
              <MenuContent>
                {moveTargets.map((t) => (
                  <MenuItem key={t.id ?? "backlog"} onSelect={() => moveSelectedTo(t.id)}>
                    {t.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          {permissions.canEditIssue && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" disabled={bulkBusy}>
                  Assignee…
                </Button>
              </MenuTrigger>
              <MenuContent className="max-h-80 overflow-y-auto">
                <MenuItem onSelect={() => updateSelected({ assigneeId: null }, "assignee")}>Unassigned</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} icon={<UserAvatar user={u} size="xs" />} onSelect={() => updateSelected({ assigneeId: u.id }, "assignee")}>
                    {u.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          {permissions.canEditIssue && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" disabled={bulkBusy}>
                  Priority…
                </Button>
              </MenuTrigger>
              <MenuContent>
                {(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as PriorityLevel[]).map((p) => (
                  <MenuItem key={p} icon={<PriorityIcon priority={p} className="h-4 w-4" />} onSelect={() => updateSelected({ priority: p }, "priority")}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Delete Sprint Confirmation */}
      {(() => {
        const sprintToDelete = sprints.find((sp) => sp.id === deletingSprintId);
        const count = sprintToDelete ? getSprintIssues(sprintToDelete.id).length : 0;
        return (
          <Dialog open={!!deletingSprintId} onOpenChange={(open) => !open && setDeletingSprintId(null)}>
            <DialogContent
              size="sm"
              title={`Delete ${sprintToDelete?.name ?? "the sprint"}?`}
              description={count > 0 ? `Its ${count} ${count === 1 ? "issue moves" : "issues move"} to the backlog.` : "It has no issues."}
              footer={
                <>
                  <Button onClick={() => setDeletingSprintId(null)}>Cancel</Button>
                  <Button variant="danger" onClick={() => deletingSprintId && handleDeleteSprint(deletingSprintId)}>
                    Delete sprint
                  </Button>
                </>
              }
            >
              {null}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Start Sprint */}
      <Dialog open={!!startingSprint} onOpenChange={(open) => !open && setStartingSprint(null)}>
        {startingSprint && (
          <DialogContent
            size="md"
            title={`Start ${startingSprint.name}`}
            description={`${getSprintIssues(startingSprint.id).length} issues planned.`}
            footer={
              <>
                <Button onClick={() => setStartingSprint(null)}>Cancel</Button>
                <Button type="submit" form="start-sprint-form" variant="primary">
                  Start sprint
                </Button>
              </>
            }
          >
            <form id="start-sprint-form" onSubmit={handleStartSprintSubmit} className="flex flex-col gap-4">
              <Field label="Sprint name" required>
                <Input value={sprintName} onChange={(e) => setSprintName(e.target.value)} />
              </Field>
              <Field label="Duration">
                <Select
                  options={[
                    { value: "7", label: "1 week" },
                    { value: "14", label: "2 weeks", description: "Recommended" },
                    { value: "21", label: "3 weeks" },
                    { value: "28", label: "4 weeks" },
                    { value: "custom", label: "Custom" },
                  ]}
                  value={durationMode}
                  onChange={handleDurationChange}
                />
              </Field>
              {durationMode === "custom" && (
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Days" className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={customDays}
                      onChange={(e) => handleCustomDaysChange(parseInt(e.target.value, 10) || 1)}
                    />
                  </Field>
                  <div role="group" aria-label="Common lengths" className="flex flex-wrap gap-1 pb-0.5">
                    {[3, 5, 10, 15, 30, 45].map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={customDays === d}
                        onClick={() => handleCustomDaysChange(d)}
                        className="h-7 rounded-control border border-subtle px-2 text-xs text-ink-2 hover:border-strong aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date" required>
                  <Input type="date" value={startDateStr} onChange={(e) => handleStartDateChange(e.target.value)} />
                </Field>
                <Field label="End date" required error={dateError ?? undefined}>
                  <Input type="date" value={endDateStr} min={startDateStr} onChange={(e) => handleEndDateChange(e.target.value)} />
                </Field>
              </div>
              {startDateStr && endDateStr && !dateError && (
                <p className="text-xs text-ink-2">
                  {customDays} {customDays === 1 ? "day" : "days"}:{" "}
                  {format(new Date(startDateStr + "T00:00:00"), "MMM d, yyyy")} – {format(new Date(endDateStr + "T00:00:00"), "MMM d, yyyy")}
                </p>
              )}
              <Field label="Sprint goal">
                <Textarea
                  rows={2}
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="What does the team aim to achieve in this sprint?"
                />
              </Field>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Complete Sprint */}
      <Dialog open={!!completingSprint} onOpenChange={(open) => !open && setCompletingSprint(null)}>
        {completingSprint && (
          <DialogContent
            size="sm"
            title={`Complete ${completingSprint.name}`}
            description="Done issues close with the sprint. Choose where the rest go."
            footer={
              <>
                <Button onClick={() => setCompletingSprint(null)}>Cancel</Button>
                <Button type="submit" form="complete-sprint-form" variant="primary">
                  Complete sprint
                </Button>
              </>
            }
          >
            <form id="complete-sprint-form" onSubmit={handleCompleteSprintSubmit}>
              <Field label="Move open issues to">
                <Select
                  options={[{ value: "", label: "Backlog" }, ...futureSprints.map((sp) => ({ value: sp.id, label: sp.name }))]}
                  value={incompleteMoveTarget}
                  onChange={setIncompleteMoveTarget}
                />
              </Field>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Issue Details Modal */}
      <IssuePanel
        issue={activeIssue}
        issues={[...epics, ...issues]}
        users={users}
        sprints={sprints}
        versions={versions}
        epics={epics}
        project={project}
          onClose={handleCloseDetailModal}
          onIssueUpdated={(up) => {
            setIssues((prev) => prev.map((i) => (i.id === up.id ? up : i)));
            if (up.type === "EPIC") {
              setEpics((prev) => {
                const exists = prev.some((e) => e.id === up.id);
                return exists ? prev.map((e) => (e.id === up.id ? up : e)) : [up, ...prev];
              });
            }
            setActiveIssue((prev) => (prev?.id === up.id ? up : prev));
          }}
          onIssueDeleted={(id) => {
            setIssues((prev) => prev.filter((i) => i.id !== id));
            setEpics((prev) => prev.filter((e) => e.id !== id));
            setActiveIssue(null);
          }}
        />

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
