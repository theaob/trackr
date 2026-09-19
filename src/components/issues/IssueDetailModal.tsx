"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Issue, IssueStatus, IssueType, PriorityLevel, User, Sprint, Version, CustomField, IssueLink, IssueLabel, WorkflowStatus, WorkflowTransition, Project, Attachment, IssueComponent, Worklog } from "@/types";
import { IssueTypeIcon, IssueTypeBadge, PriorityIcon, StatusBadge } from "@/components/common/IssueIcons";
import UserAvatar from "@/components/common/UserAvatar";
import IssueLinksSection from "@/components/issues/IssueLinksSection";
import ChildIssuesSection from "@/components/issues/ChildIssuesSection";
import LabelsSection from "@/components/issues/LabelsSection";
import AttachmentsSection from "@/components/issues/AttachmentsSection";
import ComponentsField from "@/components/issues/ComponentsField";
import TimeTrackingField from "@/components/issues/TimeTrackingField";
import IssueDescriptionEditor from "@/components/issues/IssueDescriptionEditor";

import { useCurrentUser } from "@/context/UserContext";
import { updateIssue, deleteIssue, getIssueByKeyOrId } from "@/lib/actions/issues";
import { addComment, deleteComment } from "@/lib/actions/comments";
import {
  getProjectCustomFields,
  getIssueCustomFieldValues,
  setIssueCustomFieldValue,
} from "@/lib/actions/customFields";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import { getWatchState, toggleWatch } from "@/lib/actions/watchers";
import { allowedNextStatusNames, prettifyStatusName } from "@/lib/workflowDisplay";
import { isOverdue } from "@/lib/dueDate";
import CustomFieldRenderer from "@/components/common/CustomFieldRenderer";
import MentionInput, { ImagePasteResult } from "@/components/common/MentionInput";
import MarkdownContent from "@/components/common/MarkdownContent";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { uploadAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_SIZE, formatFileSize, generatePastedImageFileName } from "@/lib/attachments";
import {
  X,
  Trash2,
  Send,
  Plus,
  CheckCircle2,
  Circle,
  MessageSquare,
  History,
  Calendar,
  ExternalLink,
  ChevronDown,
  Tag,
  Sliders,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Bookmark,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface IssueDetailModalProps {
  issue: Issue | null;
  users: User[];
  allIssues: Issue[];
  sprints?: Sprint[];
  versions?: Version[];
  /**
   * The caller's already-loaded project, members included -- role resolution
   * needs the member list, which the issue's own `project` relation never
   * carries (see below). Falls back to that relation for callers that don't
   * have a full project object handy, which only resolves correctly for the
   * project's lead.
   */
  project?: Project | null;
  onClose: () => void;
  onIssueUpdated: (updated: Issue) => void;
  onIssueDeleted: (issueId: string) => void;
}

export default function IssueDetailModal({
  issue,
  users,
  allIssues,
  sprints = [],
  versions = [],
  project,
  onClose,
  onIssueUpdated,
  onIssueDeleted,
}: IssueDetailModalProps) {
  const { currentUser } = useCurrentUser();
  const [currentIssue, setCurrentIssue] = useState<Issue | null>(issue);
  const permissions = useProjectPermissions(
    project ||
      currentIssue?.project ||
      (currentIssue?.projectId
        ? ({ id: currentIssue.projectId, key: currentIssue.key.split("-")[0] } as any)
        : null)
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(issue?.title || "");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState(issue?.description || "");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [navHistory, setNavHistory] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalPasteUploading, setModalPasteUploading] = useState(false);
  const [modalPasteError, setModalPasteError] = useState<string | null>(null);

  // Watch state
  const [watching, setWatching] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Workflow State (statuses + the transition graph, for the status dropdown)
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);

  useEffect(() => {
    setCurrentIssue(issue);
    setTitle(issue?.title || "");
    setDescription(issue?.description || "");
    setNavHistory([]);

    if (issue?.id) {
      getIssueByKeyOrId(issue.id).then((full) => {
        if (full) {
          setCurrentIssue(full as unknown as Issue);
        }
      });
    }
  }, [issue]);

  useEffect(() => {
    if (currentIssue) {
      setTitle(currentIssue.title || "");
      setDescription(currentIssue.description || "");
    }
  }, [currentIssue?.id, currentIssue?.title, currentIssue?.description]);

  // Load custom fields & values for this issue
  useEffect(() => {
    let isMounted = true;
    if (!currentIssue?.id || !currentIssue?.projectId) return;

    Promise.all([
      getProjectCustomFields(currentIssue.projectId),
      getIssueCustomFieldValues(currentIssue.id),
    ]).then(([fields, values]) => {
      if (isMounted) {
        setCustomFields(fields as any);
        const map: Record<string, string> = {};
        values.forEach((v) => {
          map[v.customFieldId] = v.value;
        });
        setCustomFieldValues(map);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentIssue?.id, currentIssue?.projectId]);

  // Load the project's workflow, for the status dropdown's allowed moves
  useEffect(() => {
    let isMounted = true;
    if (!currentIssue?.projectId) return;

    getProjectWorkflow(currentIssue.projectId).then(({ statuses, transitions }) => {
      if (isMounted) {
        setWorkflowStatuses(statuses as unknown as WorkflowStatus[]);
        setWorkflowTransitions(transitions as unknown as WorkflowTransition[]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentIssue?.projectId]);

  // Load watch state for the signed-in caller
  useEffect(() => {
    let isMounted = true;
    if (!currentIssue?.id || !currentUser) return;

    getWatchState(currentIssue.id).then(({ watching, count }) => {
      if (isMounted) {
        setWatching(watching);
        setWatcherCount(count);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentIssue?.id, currentUser]);

  // Escape closes the modal, matching the X button -- unless a nested field
  // (title edit, add-label input) already handled it and stopped it there.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleToggleWatch = async () => {
    if (!currentIssue) return;
    const res = await toggleWatch(currentIssue.id);
    if (res.success) {
      setWatching(res.watching);
      setWatcherCount(res.count);
    }
  };

  const handleCustomFieldChange = async (fieldId: string, val: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: val }));
    if (!currentIssue) return;
    await setIssueCustomFieldValue(currentIssue.id, fieldId, val);
  };

  // Handle Attachment added/removed
  const handleAttachmentAdded = useCallback(
    (attachment: Attachment) => {
      if (!currentIssue) return;
      const updatedIssue = {
        ...currentIssue,
        attachments: [attachment, ...(currentIssue.attachments || [])],
      };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    },
    [currentIssue, onIssueUpdated]
  );

  const handleAttachmentRemoved = useCallback(
    (attachmentId: string) => {
      if (!currentIssue) return;
      const updatedIssue = {
        ...currentIssue,
        attachments: (currentIssue.attachments || []).filter((a) => a.id !== attachmentId),
      };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    },
    [currentIssue, onIssueUpdated]
  );

  const handleImagePaste = useCallback(
    async (file: File): Promise<ImagePasteResult> => {
      if (!currentIssue) return { success: false, error: "No issue selected" };
      if (!permissions.canAddComment) {
        return { success: false, error: "You don't have permission to attach files." };
      }
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

      const res = await uploadAttachment(currentIssue.id, formData);
      if (res.success && res.attachment) {
        const att = res.attachment as unknown as Attachment;
        handleAttachmentAdded(att);
        return {
          success: true,
          url: `/api/v1/attachments/${att.id}`,
          fileName: att.fileName,
        };
      }
      return {
        success: false,
        error: (res as { error?: string }).error || "Failed to upload image",
      };
    },
    [currentIssue, permissions.canAddComment, handleAttachmentAdded]
  );

  // Window-level paste listener for the modal (when not focused on a text input)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;
      if (!currentIssue || !permissions.canAddComment) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      let imageFile: File | null = null;
      if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const file = clipboardData.files[i];
          if (file.type.startsWith("image/")) {
            imageFile = file;
            break;
          }
        }
      }

      if (!imageFile && clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type.startsWith("image/")) {
            imageFile = item.getAsFile();
            break;
          }
        }
      }

      if (!imageFile) return;

      e.preventDefault();
      setModalPasteUploading(true);
      setModalPasteError(null);

      try {
        const res = await handleImagePaste(imageFile);
        if (!res.success && res.error) {
          setModalPasteError(res.error);
          setTimeout(() => setModalPasteError(null), 4000);
        }
      } catch (err: any) {
        setModalPasteError(err?.message || "Failed to paste image");
        setTimeout(() => setModalPasteError(null), 4000);
      } finally {
        setModalPasteUploading(false);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [currentIssue, permissions.canAddComment, handleImagePaste]);

  if (!currentIssue) return null;


  const childIds = new Set((currentIssue.children || []).map((c: any) => c.id));
  const epics = allIssues.filter((i) => i.type === "EPIC" && i.id !== currentIssue.id && !childIds.has(i.id));

  // Handle Save Title
  const handleSaveTitle = async () => {
    if (!title.trim() || title === currentIssue.title) {
      setTitle(currentIssue.title);
      setIsEditingTitle(false);
      return;
    }
    const res = await updateIssue(currentIssue.id, {
      title: title.trim(),
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
    setIsEditingTitle(false);
  };

  // Handle Save Description
  const handleSaveDescription = async () => {
    const res = await updateIssue(currentIssue.id, {
      description,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
    setIsEditingDesc(false);
  };

  // Handle Type Change
  const handleTypeChange = async (newType: IssueType) => {
    const res = await updateIssue(currentIssue.id, {
      type: newType,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Status Change

  const handleStatusChange = async (newStatus: IssueStatus) => {
    const res = await updateIssue(currentIssue.id, {
      status: newStatus,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    } else if (!res.success && res.error) {
      alert(res.error);
    }
  };

  // Handle Priority Change
  const handlePriorityChange = async (newPriority: PriorityLevel) => {
    const res = await updateIssue(currentIssue.id, {
      priority: newPriority,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Assignee Change
  const handleAssigneeChange = async (newAssigneeId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      assigneeId: newAssigneeId,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Parent Epic Change
  const handleParentChange = async (parentId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      parentId: parentId || null,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Sprint Change (supports adding to sprint before it starts)
  const handleSprintChange = async (sprintId: string | null) => {
    // Prevent adding to completed sprints
    if (sprintId && sprintId !== currentIssue.sprintId) {
      const targetSprint = sprints.find((s) => s.id === sprintId);
      if (targetSprint && targetSprint.status === "COMPLETED") {
        return;
      }
    }

    const currentIsBacklog = workflowStatuses.find((s) => s.name === currentIssue.status)?.isBacklog;
    const initialStatus = workflowStatuses.find((s) => !s.isBacklog)?.name ?? currentIssue.status;
    const newStatus = sprintId && currentIsBacklog ? initialStatus : currentIssue.status;
    const res = await updateIssue(currentIssue.id, {
      sprintId: sprintId || null,
      status: newStatus,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Version Change
  const handleVersionChange = async (versionId: string | null) => {
    const res = await updateIssue(currentIssue.id, {
      versionId: versionId || null,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Story Points Change
  const handleStoryPointsChange = async (pointsStr: string) => {
    const points = pointsStr === "" ? null : parseInt(pointsStr, 10);
    const res = await updateIssue(currentIssue.id, {
      storyPoints: points,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      // updateIssue's response doesn't refetch labels/links (loaded separately by
      // their own sections), so merge onto the current issue instead of replacing it.
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Due Date Change
  const handleDueDateChange = async (dateStr: string) => {
    const res = await updateIssue(currentIssue.id, {
      dueDate: dateStr === "" ? null : dateStr,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Start Date Change (Epics only -- the field the roadmap plots)
  const handleStartDateChange = async (dateStr: string) => {
    const res = await updateIssue(currentIssue.id, {
      startDate: dateStr === "" ? null : dateStr,
      updatedByUserId: currentUser?.id,
    });
    if (res.success && res.issue) {
      const typed = { ...currentIssue, ...res.issue } as unknown as Issue;
      setCurrentIssue(typed);
      onIssueUpdated(typed);
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    setIsSubmittingComment(true);
    const res = await addComment(currentIssue.id, currentUser.id, newComment);
    setIsSubmittingComment(false);
    if (res.success && res.comment) {
      setNewComment("");
      const updatedComments = [res.comment, ...(currentIssue.comments || [])];
      const updatedIssue = { ...currentIssue, comments: updatedComments };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    const res = await deleteComment(commentId);
    if (res.success) {
      const updatedComments = (currentIssue.comments || []).filter((c) => c.id !== commentId);
      const updatedIssue = { ...currentIssue, comments: updatedComments };
      setCurrentIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
    }
  };

  // Handle Issue Link added/removed
  const handleIssueLinked = (link: IssueLink) => {
    const updatedIssue = {
      ...currentIssue,
      linksAsSource: [...(currentIssue.linksAsSource || []), link],
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleIssueUnlinked = (linkId: string) => {
    const updatedIssue = {
      ...currentIssue,
      linksAsSource: (currentIssue.linksAsSource || []).filter((l) => l.id !== linkId),
      linksAsTarget: (currentIssue.linksAsTarget || []).filter((l) => l.id !== linkId),
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  // Handle Label added/removed
  const handleLabelAdded = (issueLabel: IssueLabel) => {
    const updatedIssue = {
      ...currentIssue,
      labels: [...(currentIssue.labels || []).filter((l) => l.labelId !== issueLabel.labelId), issueLabel],
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleLabelRemoved = (labelId: string) => {
    const updatedIssue = {
      ...currentIssue,
      labels: (currentIssue.labels || []).filter((l) => l.labelId !== labelId),
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };



  // Handle Component added/removed
  const handleComponentAdded = (issueComponent: IssueComponent) => {
    const updatedIssue = {
      ...currentIssue,
      components: [
        ...(currentIssue.components || []).filter((c) => c.componentId !== issueComponent.componentId),
        issueComponent,
      ],
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleComponentRemoved = (componentId: string) => {
    const updatedIssue = {
      ...currentIssue,
      components: (currentIssue.components || []).filter((c) => c.componentId !== componentId),
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  // Handle Time Tracking changes
  const handleEstimatesChanged = (originalEstimateSeconds: number | null, remainingEstimateSeconds: number | null) => {
    const updatedIssue = { ...currentIssue, originalEstimateSeconds, remainingEstimateSeconds };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleWorklogAdded = (worklog: Worklog, remainingEstimateSeconds: number | null) => {
    const updatedIssue = {
      ...currentIssue,
      worklogs: [worklog, ...(currentIssue.worklogs || [])],
      remainingEstimateSeconds,
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  const handleWorklogRemoved = (worklogId: string, remainingEstimateSeconds: number | null) => {
    const updatedIssue = {
      ...currentIssue,
      worklogs: (currentIssue.worklogs || []).filter((w) => w.id !== worklogId),
      remainingEstimateSeconds,
    };
    setCurrentIssue(updatedIssue);
    onIssueUpdated(updatedIssue);
  };

  // Handle Child Issues
  const handleChildAdded = (newChild: Issue) => {
    const updatedChildren = [...(currentIssue.children || []), newChild];
    const updated = { ...currentIssue, children: updatedChildren };
    setCurrentIssue(updated);
    onIssueUpdated(updated);
  };

  const handleChildRemoved = (childId: string) => {
    const updatedChildren = (currentIssue.children || []).filter((c: any) => c.id !== childId);
    const updated = { ...currentIssue, children: updatedChildren };
    setCurrentIssue(updated);
    onIssueUpdated(updated);
  };

  const handleOpenChild = async (childKeyOrId: string) => {
    setNavHistory((prev) => [...prev, currentIssue]);
    const fetched = await getIssueByKeyOrId(childKeyOrId);
    if (fetched) {
      setCurrentIssue(fetched as unknown as Issue);
      try {
        window.dispatchEvent(
          new CustomEvent("jira:open-issue", { detail: { issueKey: fetched.key } })
        );
      } catch {}
    }
  };

  const handleOpenParent = async (parentKeyOrId: string) => {
    setNavHistory((prev) => [...prev, currentIssue]);
    const fetched = await getIssueByKeyOrId(parentKeyOrId);
    if (fetched) {
      setCurrentIssue(fetched as unknown as Issue);
      try {
        window.dispatchEvent(
          new CustomEvent("jira:open-issue", { detail: { issueKey: fetched.key } })
        );
      } catch {}
    }
  };

  const handleBackToPrevious = () => {
    if (navHistory.length === 0) return;
    const prevIssue = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));
    setCurrentIssue(prevIssue);
    try {
      window.dispatchEvent(
        new CustomEvent("jira:open-issue", { detail: { issueKey: prevIssue.key } })
      );
    } catch {}
  };

  // Handle Delete Issue
  const handleDeleteIssue = async () => {
    if (!window.confirm(`Are you sure you want to delete ${currentIssue.key}?`)) return;
    setIsDeleting(true);
    const res = await deleteIssue(currentIssue.id);
    if (res.success) {
      onIssueDeleted(currentIssue.id);
      onClose();
    }
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg shadow-2xl border border-jira-gray-300 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-jira-gray-200 bg-jira-gray-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {navHistory.length > 0 && (
              <button
                type="button"
                onClick={handleBackToPrevious}
                className="p-1 -ml-1 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors"
                title="Back to previous issue"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {currentIssue.parent && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenParent(currentIssue.parent!.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded transition-colors max-w-[200px] truncate"
                  title={`Parent Epic: ${currentIssue.parent.title} (${currentIssue.parent.key})`}
                >
                  <Bookmark className="w-3 h-3 text-purple-700 fill-purple-700 shrink-0" />
                  <span className="truncate">{currentIssue.parent.title}</span>
                </button>
                <span className="text-jira-gray-400 text-xs">/</span>
              </div>
            )}

            <IssueTypeBadge type={currentIssue.type} size="sm" showLabel />
            <span className="text-sm font-bold text-jira-gray-700">{currentIssue.key}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser && (
              <button
                onClick={handleToggleWatch}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                  watching
                    ? "text-jira-blue bg-jira-blue-light/60 hover:bg-jira-blue-light"
                    : "text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-200"
                }`}
                title={watching ? "Stop watching this issue" : "Watch this issue for updates"}
              >
                {watching ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {watcherCount > 0 && <span>{watcherCount}</span>}
              </button>
            )}
            {permissions.canDeleteIssue && (
              <button
                onClick={handleDeleteIssue}
                disabled={isDeleting}
                className="p-1.5 text-jira-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Delete Issue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-200 rounded transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          {/* Left Main Content */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 md:border-r border-jira-gray-200">
            {/* Title Editing */}
            <div>
              {isEditingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setTitle(currentIssue.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    className="w-full text-xl font-bold text-jira-navy px-2 py-1 border-2 border-jira-blue rounded outline-none"
                  />
                  <div className="text-xs text-jira-gray-500">Press Enter to save, Esc to cancel</div>
                </div>
              ) : (
                <h1
                  onClick={() => permissions.canEditIssue && setIsEditingTitle(true)}
                  className={`text-xl font-bold text-jira-navy p-1.5 -ml-1.5 rounded transition-colors ${
                    permissions.canEditIssue ? "cursor-pointer hover:bg-jira-gray-100" : ""
                  }`}
                  title={permissions.canEditIssue ? "Click to edit title" : undefined}
                >
                  {currentIssue.title}
                </h1>
              )}
            </div>

            {/* Mobile Quick Actions Strip (< md) */}
            <div className="md:hidden flex flex-wrap items-center gap-2 p-3 bg-jira-gray-50 rounded-lg border border-jira-gray-200">
              {/* Quick Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-jira-gray-500 uppercase">Status:</span>
                <select
                  value={currentIssue.status}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                  className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs font-semibold text-jira-navy outline-none focus:border-jira-blue"
                >
                  {allowedNextStatusNames(currentIssue.status, workflowStatuses, workflowTransitions).map(
                    (name) => (
                      <option key={name} value={name}>
                        {prettifyStatusName(name)}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Quick Assignee */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-jira-gray-500 uppercase">Assignee:</span>
                <select
                  value={currentIssue.assigneeId || ""}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handleAssigneeChange(e.target.value || null)}
                  className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs text-jira-navy outline-none focus:border-jira-blue max-w-[130px] truncate"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Priority */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-jira-gray-500 uppercase">Priority:</span>
                <select
                  value={currentIssue.priority}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                  className="bg-white border border-jira-gray-300 rounded px-2 py-1 text-xs text-jira-navy outline-none focus:border-jira-blue"
                >
                  <option value="HIGHEST">Highest</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="LOWEST">Lowest</option>
                </select>
              </div>

              {/* Story Points */}
              {currentIssue.storyPoints !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-jira-gray-500 uppercase">Pts:</span>
                  <span className="text-xs font-bold text-jira-gray-800 bg-jira-gray-200 px-2 py-0.5 rounded-full">
                    {currentIssue.storyPoints}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <IssueDescriptionEditor
              value={description}
              onChange={setDescription}
              users={users}
              mode="click-to-edit"
              canEdit={permissions.canEditIssue}
              onSave={handleSaveDescription}
              onCancel={() => {
                setDescription(currentIssue.description || "");
              }}
              onImagePaste={handleImagePaste}
              placeholder="Add details, steps, or acceptance criteria..."
            />

            {/* Child / Epic Issues */}
            <div className="pt-4 border-t border-jira-gray-200">
              <ChildIssuesSection
                parentIssue={currentIssue}
                childIssues={currentIssue.children as any}
                canEdit={permissions.canEditIssue}
                workflowStatuses={workflowStatuses}
                onChildAdded={handleChildAdded}
                onChildRemoved={handleChildRemoved}
                onOpenChild={handleOpenChild}
              />
            </div>

            {/* Labels */}
            <div className="pt-4 border-t border-jira-gray-200">
              <LabelsSection
                issueId={currentIssue.id}
                projectId={currentIssue.projectId}
                labels={currentIssue.labels}
                canEdit={permissions.canEditIssue}
                onLabelAdded={handleLabelAdded}
                onLabelRemoved={handleLabelRemoved}
              />
            </div>

            {/* Attachments */}
            <div className="pt-4 border-t border-jira-gray-200">
              <AttachmentsSection
                issueId={currentIssue.id}
                attachments={currentIssue.attachments}
                canUpload={permissions.canAddComment}
                canDelete={(attachment) => permissions.isAdmin || attachment.uploadedById === currentUser?.id}
                onAttachmentAdded={handleAttachmentAdded}
                onAttachmentRemoved={handleAttachmentRemoved}
              />
            </div>

            {/* Linked Issues */}
            <div className="pt-4 border-t border-jira-gray-200">
              <IssueLinksSection
                issueId={currentIssue.id}
                linksAsSource={currentIssue.linksAsSource}
                linksAsTarget={currentIssue.linksAsTarget}
                canEdit={permissions.canEditIssue}
                onIssueLinked={handleIssueLinked}
                onIssueUnlinked={handleIssueUnlinked}
              />
            </div>

            {/* Activity & Comments Section */}
            <div className="pt-4 border-t border-jira-gray-200">
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
                  <span>Comments ({currentIssue.comments?.length || 0})</span>
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
                  <span>Activity History</span>
                </button>
              </div>

              {/* Tab: Comments */}
              {activeTab === "comments" && (
                <div className="space-y-4">
                  {/* New Comment Input */}
                  {permissions.canAddComment ? (
                    <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                      <UserAvatar
                        user={currentUser}
                        size="lg"
                        className="mt-1 border"
                      />
                      <div className="flex-1">
                        <MentionInput
                          value={newComment}
                          onChange={setNewComment}
                          users={users}
                          multiline={true}
                          rows={2}
                          placeholder="Add a comment... (Type @ to mention, paste images directly)"
                          onSubmit={handleAddComment}
                          onImagePaste={handleImagePaste}
                          className="w-full px-3 py-2 text-sm border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                        />
                        <p className="mt-1 text-[11px] text-jira-gray-400">Markdown supported</p>
                        {newComment.trim().length > 0 && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="submit"
                              disabled={isSubmittingComment}
                              className="bg-jira-blue text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-jira-blue-hover"
                            >
                              Save comment
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewComment("")}
                              className="px-3 py-1.5 text-jira-gray-600 hover:bg-jira-gray-100 rounded text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="p-2.5 bg-jira-gray-50 border border-jira-gray-200 rounded text-xs text-jira-gray-500 italic">
                      Stakeholders/Viewers have read-only access and cannot post comments.
                    </div>
                  )}

                  {/* Comments List */}
                  <div className="space-y-3 pt-2">
                    {currentIssue.comments?.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex gap-3 group text-sm p-2 rounded-md hover:bg-jira-gray-50"
                      >
                        <UserAvatar user={comment.author} size="md" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-jira-navy text-xs">
                                {comment.author.name}
                              </span>
                              <span className="text-[11px] text-jira-gray-500">
                                {formatDistanceToNow(new Date(comment.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-jira-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <MarkdownContent
                            text={comment.content}
                            users={users}
                            className="mt-1 text-jira-gray-800 text-sm leading-normal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Activity History */}
              {activeTab === "history" && (
                <div className="space-y-2 text-xs">
                  {currentIssue.activityLogs && currentIssue.activityLogs.length > 0 ? (
                    currentIssue.activityLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 py-1 text-jira-gray-700">
                        <span className="font-bold text-jira-navy">{log.user?.name || "User"}</span>
                        <span>{log.action.toLowerCase().replace("_", " ")}</span>
                        {log.field && <span className="font-medium text-jira-blue">[{log.field}]</span>}
                        {log.newValue && (
                          <span>
                            to <strong className="text-jira-navy">{log.newValue}</strong>
                          </span>
                        )}
                        <span className="text-jira-gray-400 ml-auto">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-jira-gray-500 italic py-2">No activity recorded yet</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Details */}
          <div className="w-full md:w-72 p-6 bg-jira-gray-50/70 space-y-5 text-sm">
            {/* Issue Type Selector */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Issue Type
              </label>
              <div className="relative">
                <select
                  value={currentIssue.type}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handleTypeChange(e.target.value as IssueType)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-8 pr-3 py-1.5 text-xs font-semibold text-jira-navy focus:border-jira-blue outline-none shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="STORY">Story</option>
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="EPIC">Epic</option>
                  <option value="SUBTASK">Subtask</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <IssueTypeIcon type={currentIssue.type} className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={currentIssue.status}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                className="w-full bg-white border border-jira-gray-300 rounded px-3 py-1.5 text-xs font-semibold text-jira-navy focus:border-jira-blue outline-none shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {allowedNextStatusNames(currentIssue.status, workflowStatuses, workflowTransitions).map(
                  (name) => (
                    <option key={name} value={name}>
                      {prettifyStatusName(name)}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-jira-gray-600 uppercase tracking-wider">
                  Assignee
                </label>
                {currentUser && currentIssue.assigneeId !== currentUser.id && permissions.canEditIssue && (
                  <button
                    onClick={() => handleAssigneeChange(currentUser.id)}
                    className="text-[11px] text-jira-blue hover:underline font-semibold"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              <select
                value={currentIssue.assigneeId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleAssigneeChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Reporter */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Reporter
              </label>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded text-xs text-jira-navy">
                <UserAvatar
                  user={currentIssue.reporter}
                  size="xs"
                  className="w-4 h-4"
                />
                <span>{currentIssue.reporter?.name || "Anonymous"}</span>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="relative">
                <select
                  value={currentIssue.priority}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                  className="w-full bg-white border border-jira-gray-300 rounded pl-7 pr-3 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="HIGHEST">Highest</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="LOWEST">Lowest</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PriorityIcon priority={currentIssue.priority} className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Story Points */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="None"
                disabled={!permissions.canEditIssue}
                value={currentIssue.storyPoints ?? ""}
                onChange={(e) => handleStoryPointsChange(e.target.value)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Time Tracking */}
            <TimeTrackingField
              issueId={currentIssue.id}
              originalEstimateSeconds={currentIssue.originalEstimateSeconds}
              remainingEstimateSeconds={currentIssue.remainingEstimateSeconds}
              worklogs={currentIssue.worklogs}
              canEdit={permissions.canEditIssue}
              canLogWork={permissions.canAddComment}
              isAdmin={permissions.isAdmin}
              currentUserId={currentUser?.id}
              onEstimatesChanged={handleEstimatesChanged}
              onWorklogAdded={handleWorklogAdded}
              onWorklogRemoved={handleWorklogRemoved}
            />

            {/* Start Date (Epics only -- the field the Roadmap plots) */}
            {currentIssue.type === "EPIC" && (
              <div>
                <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  disabled={!permissions.canEditIssue}
                  value={currentIssue.startDate ? format(new Date(currentIssue.startDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                disabled={!permissions.canEditIssue}
                value={currentIssue.dueDate ? format(new Date(currentIssue.dueDate), "yyyy-MM-dd") : ""}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className={`w-full bg-white border rounded px-2.5 py-1.5 text-xs focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                  isOverdue(
                    currentIssue.dueDate,
                    currentIssue.status,
                    workflowStatuses.filter((s) => s.category === "DONE").map((s) => s.name)
                  )
                    ? "border-rose-300 text-rose-700 font-semibold"
                    : "border-jira-gray-300 text-jira-navy"
                }`}
              />
            </div>

            {/* Parent Epic */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider">
                  Parent Epic
                </label>
                {currentIssue.parentId && (
                  <button
                    type="button"
                    onClick={() => handleOpenParent(currentIssue.parentId!)}
                    className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                  >
                    <span>View Epic</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <select
                value={currentIssue.parentId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleParentChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">None (No Epic)</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.key}: {epic.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Sprint (Epics span multiple sprints and cannot be assigned to a sprint) */}
            {currentIssue.type !== "EPIC" && (
              <div>
                <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5">
                  Sprint
                </label>
                <select
                  value={currentIssue.sprintId || ""}
                  disabled={!permissions.canEditIssue}
                  onChange={(e) => handleSprintChange(e.target.value || null)}
                  className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Backlog (No Sprint)</option>
                  {sprints
                    .filter((s) => s.status !== "COMPLETED" || s.id === currentIssue.sprintId)
                    .map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={s.status === "COMPLETED" && s.id !== currentIssue.sprintId}
                      >
                        {s.name} {s.status === "ACTIVE" ? "(Active)" : s.status === "FUTURE" ? "(Future / Planned)" : "(Completed - Closed)"}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Fix Version */}
            <div>
              <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-jira-blue" />
                Fix Version
              </label>
              <select
                value={currentIssue.versionId || ""}
                disabled={!permissions.canEditIssue}
                onChange={(e) => handleVersionChange(e.target.value || null)}
                className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">None (Unassigned)</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Components */}
            <ComponentsField
              issueId={currentIssue.id}
              projectId={currentIssue.projectId}
              components={currentIssue.components}
              canEdit={permissions.canEditIssue}
              onComponentAdded={handleComponentAdded}
              onComponentRemoved={handleComponentRemoved}
            />

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="pt-4 border-t border-jira-gray-200 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-jira-blue" />
                  <span className="text-xs font-bold text-jira-gray-600 uppercase tracking-wider">
                    Custom Fields
                  </span>
                </div>
                <div className="space-y-3">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-jira-gray-700">
                        <span>{field.name}</span>
                        {field.required && (
                          <span className="text-[10px] text-jira-red font-semibold">
                            Required
                          </span>
                        )}
                      </div>
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.id] || ""}
                        readOnly={!permissions.canEditIssue}
                        onChange={(val) => permissions.canEditIssue && handleCustomFieldChange(field.id, val)}
                      />
                      {field.description && (
                        <p className="text-[10px] text-jira-gray-400 leading-tight">
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Timestamps */}
            <div className="pt-4 border-t border-jira-gray-200 text-[11px] text-jira-gray-500 space-y-1">
              <div>Created: {format(new Date(currentIssue.createdAt), "MMM d, yyyy, h:mm a")}</div>
              <div>Updated: {format(new Date(currentIssue.updatedAt), "MMM d, yyyy, h:mm a")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal-wide image paste feedback toasts */}
      {modalPasteUploading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-jira-navy text-white text-xs px-3.5 py-2.5 rounded-lg shadow-xl border border-jira-gray-700 animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="w-4 h-4 animate-spin text-jira-blue-light" />
          <span>Uploading pasted image to attachments...</span>
        </div>
      )}
      {modalPasteError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-rose-600 text-white text-xs px-3.5 py-2.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{modalPasteError}</span>
        </div>
      )}
    </div>
  );
}
