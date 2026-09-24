"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Attachment,
  CustomField,
  Issue,
  IssueComponent,
  IssueLabel,
  IssueLink,
  IssueStatus,
  IssueType,
  PriorityLevel,
  Project,
  Sprint,
  User,
  Version,
  WorkflowStatus,
  WorkflowTransition,
  Worklog,
} from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useToast } from "@/components/ui/Toast";
import { recordRecentIssue } from "@/lib/recentIssuesStore";
import { projectKeyOfIssue } from "@/lib/issueUrls";
import { deleteIssue, getIssueByKeyOrId, getOlderIssueHistory, getProjectEpics, updateIssue } from "@/lib/actions/issues";
import { addComment, deleteComment } from "@/lib/actions/comments";
import { getProjectVersions } from "@/lib/actions/versions";
import { getProjectByKey, getProjectUsers } from "@/lib/actions/projects";
import { getProjectSprints } from "@/lib/actions/sprints";
import { getIssueCustomFieldValues, getProjectCustomFields, setIssueCustomFieldValue } from "@/lib/actions/customFields";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import { getWatchState, toggleWatch } from "@/lib/actions/watchers";
import { uploadAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_SIZE, formatFileSize, generatePastedImageFileName } from "@/lib/attachments";
import { oldestLoadedId, withCommentCountChange, withOlderHistory, type HistoryKind } from "@/lib/issueHistory";
import type { ImagePasteResult } from "@/components/common/MentionInput";

/** What the page hosting the view already has loaded; anything missing is fetched. */
export interface IssueContext {
  /** The host's project, members included (roles need them). */
  project?: Project | null;
  users?: User[];
  sprints?: Sprint[];
  versions?: Version[];
  epics?: Issue[];
}

export interface UseIssueDataOptions extends IssueContext {
  issue: Issue;
  onIssueUpdated?: (issue: Issue) => void;
  onIssueDeleted?: (issueId: string) => void;
}

/**
 * Everything the issue view reads and changes: the full issue, the project
 * around it (workflow, people, sprints, versions, epics, custom fields) and
 * every edit, applied optimistically and rolled back with a toast on failure.
 * Hosts are told about each change through onIssueUpdated so their lists stay
 * current.
 */
export function useIssueData({
  issue,
  project: hostProject,
  users: hostUsers,
  sprints: hostSprints,
  versions: hostVersions,
  epics: hostEpics,
  onIssueUpdated,
  onIssueDeleted,
}: UseIssueDataOptions) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [current, setCurrent] = useState<Issue>(issue);
  const [loaded, setLoaded] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState<HistoryKind[] | null>(null);

  const onUpdatedRef = useRef(onIssueUpdated);
  onUpdatedRef.current = onIssueUpdated;
  const publish = useCallback((next: Issue) => {
    setCurrent(next);
    onUpdatedRef.current?.(next);
  }, []);

  // A different issue: start over from what the host has, then load it in full.
  // The same issue changed by the host (a drag on the board): take its fields.
  const issueId = issue.id;
  const lastIssueId = useRef(issue.id);
  useEffect(() => {
    if (lastIssueId.current !== issue.id) {
      lastIssueId.current = issue.id;
      setLoaded(false);
      setCurrent(issue);
    } else {
      // A host's list copy has no threads; keep ours. A full copy (the page
      // re-rendered after a change) is fresher: take its threads with their counts.
      setCurrent((prev) => {
        const next = { ...prev, ...issue };
        if (!issue.comments || !issue.activityLogs) {
          next.comments = prev.comments ?? issue.comments;
          next.activityLogs = prev.activityLogs ?? issue.activityLogs;
          next._count = prev._count ?? issue._count;
        }
        return next;
      });
    }
  }, [issue]);

  useEffect(() => {
    let live = true;
    getIssueByKeyOrId(issueId).then((full) => {
      if (live && full) {
        setCurrent(full as unknown as Issue);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, [issueId]);

  // ---- The project around the issue ------------------------------------------
  const projectId = current.projectId;
  const inHostProject = !!hostProject && hostProject.id === projectId;
  const [otherProject, setOtherProject] = useState<Project | null>(null);
  const projectKey = current.project?.key ?? projectKeyOfIssue(current.key);
  useEffect(() => {
    if (inHostProject) return;
    let live = true;
    getProjectByKey(projectKey).then((p) => live && setOtherProject((p as unknown as Project) ?? null));
    return () => {
      live = false;
    };
  }, [inHostProject, projectKey]);
  const project: Project | null = inHostProject ? hostProject! : (otherProject ?? (current.project as Project | undefined) ?? null);
  const permissions = useProjectPermissions(project);
  const isKanban = project?.boardType === "KANBAN";

  const [fetchedUsers, setFetchedUsers] = useState<User[] | null>(null);
  const [fetchedSprints, setFetchedSprints] = useState<Sprint[] | null>(null);
  const [fetchedVersions, setFetchedVersions] = useState<Version[] | null>(null);
  const [fetchedEpics, setFetchedEpics] = useState<Issue[] | null>(null);
  const needUsers = !(inHostProject && hostUsers);
  const needSprints = !(inHostProject && hostSprints);
  const needVersions = !(inHostProject && hostVersions && hostVersions.length > 0);
  const needEpics = !(inHostProject && hostEpics);
  useEffect(() => {
    let live = true;
    if (needUsers) getProjectUsers(projectId).then((u) => live && setFetchedUsers(u as unknown as User[]));
    if (needSprints) getProjectSprints(projectId).then((s) => live && setFetchedSprints(s as unknown as Sprint[]));
    if (needVersions) getProjectVersions(projectId).then((v) => live && setFetchedVersions((v as unknown as Version[]) ?? []));
    if (needEpics) getProjectEpics(projectId).then((e) => live && setFetchedEpics(e as unknown as Issue[]));
    return () => {
      live = false;
    };
  }, [projectId, needUsers, needSprints, needVersions, needEpics]);
  const users = (needUsers ? fetchedUsers : hostUsers) ?? [];
  const sprints = (needSprints ? fetchedSprints : hostSprints) ?? [];
  const versions = (needVersions ? fetchedVersions : hostVersions) ?? [];
  const allEpics = useMemo(() => (needEpics ? fetchedEpics : hostEpics) ?? [], [needEpics, fetchedEpics, hostEpics]);

  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  useEffect(() => {
    let live = true;
    getProjectWorkflow(projectId).then((w) => {
      if (!live) return;
      setStatuses(w.statuses as unknown as WorkflowStatus[]);
      setTransitions(w.transitions as unknown as WorkflowTransition[]);
    });
    return () => {
      live = false;
    };
  }, [projectId]);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    Promise.all([getProjectCustomFields(projectId), getIssueCustomFieldValues(issueId)]).then(([fields, values]) => {
      if (!live) return;
      setCustomFields(fields as unknown as CustomField[]);
      setCustomFieldValues(Object.fromEntries(values.map((v) => [v.customFieldId, v.value])));
    });
    return () => {
      live = false;
    };
  }, [projectId, issueId]);

  const [watch, setWatch] = useState({ watching: false, count: 0 });
  const signedIn = !!currentUser;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    getWatchState(issueId).then(({ watching, count }) => live && setWatch({ watching, count }));
    return () => {
      live = false;
    };
  }, [issueId, signedIn]);

  // Remembered for Home and ⌘K search ("recently viewed"), in this browser only.
  useEffect(() => {
    if (!current.key || !current.title) return;
    recordRecentIssue(currentUser?.id, { key: current.key, title: current.title, projectKey });
  }, [currentUser?.id, current.key, current.title, projectKey]);

  const epics = useMemo(() => {
    const childIds = new Set((current.children ?? []).map((c: { id: string }) => c.id));
    return allEpics.filter((e) => e.id !== current.id && !childIds.has(e.id));
  }, [allEpics, current.id, current.children]);

  const canDelete =
    permissions.isAdmin || (permissions.canDeleteIssue && (permissions.canModerate || current.reporterId === currentUser?.id));

  // ---- Edits ------------------------------------------------------------------
  const currentRef = useRef(current);
  currentRef.current = current;

  const fail = useCallback((title: string, description?: string) => toast({ title, description, tone: "danger" }), [toast]);

  const apply = useCallback(
    async (changes: Partial<Issue>, payload: Parameters<typeof updateIssue>[1]) => {
      const previous = currentRef.current;
      const optimistic = { ...previous, ...changes };
      publish(optimistic);
      const res = await updateIssue(previous.id, { ...payload, updatedByUserId: currentUser?.id });
      if (res.success && res.issue) {
        // Keep what this view loaded (history, links, children) that the update doesn't return.
        publish({
          ...currentRef.current,
          ...(res.issue as unknown as Issue),
          comments: currentRef.current.comments,
          activityLogs: currentRef.current.activityLogs,
        });
      } else {
        publish(previous);
        fail("Couldn't save the change", res.error);
      }
    },
    [currentUser?.id, publish, fail]
  );

  const setTitle = (title: string) => {
    const next = title.trim();
    if (!next || next === currentRef.current.title) return;
    return apply({ title: next }, { title: next });
  };
  const setDescription = (description: string) => apply({ description }, { description });
  const setType = (type: IssueType) => apply({ type }, { type });
  const setStatus = (status: IssueStatus) => apply({ status }, { status });
  const setPriority = (priority: PriorityLevel) => apply({ priority }, { priority });
  const setAssignee = (assigneeId: string | null) => {
    const assignee = users.find((u) => u.id === assigneeId) ?? (assigneeId === currentUser?.id ? currentUser : null);
    return apply({ assigneeId, assignee }, { assigneeId });
  };
  const setParent = (parentId: string | null) => {
    const epic = epics.find((e) => e.id === parentId);
    const parent = epic ? { id: epic.id, key: epic.key, title: epic.title, type: epic.type } : null;
    return apply({ parentId, parent }, { parentId });
  };
  const setSprint = (sprintId: string | null) => {
    const issueNow = currentRef.current;
    if (sprintId && sprintId !== issueNow.sprintId && sprints.find((s) => s.id === sprintId)?.status === "COMPLETED") return;
    // Planning an issue into a sprint takes it out of the backlog column.
    const inBacklog = statuses.find((s) => s.name === issueNow.status)?.isBacklog;
    const firstStatus = statuses.find((s) => !s.isBacklog)?.name ?? issueNow.status;
    const status = sprintId && inBacklog ? firstStatus : issueNow.status;
    return apply({ sprintId, status, sprint: sprints.find((s) => s.id === sprintId) ?? null }, { sprintId, status });
  };
  const setVersion = (versionId: string | null) =>
    apply({ versionId, version: versions.find((v) => v.id === versionId) ?? null }, { versionId });
  const setStoryPoints = (storyPoints: number | null) => apply({ storyPoints }, { storyPoints });
  const setDueDate = (value: string) => {
    const dueDate = value || null;
    return apply({ dueDate }, { dueDate });
  };
  const setStartDate = (value: string) => {
    const startDate = value || null;
    return apply({ startDate }, { startDate });
  };

  const setCustomFieldValue = async (fieldId: string, value: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    const res = (await setIssueCustomFieldValue(currentRef.current.id, fieldId, value)) as
      | { success?: boolean; error?: string }
      | undefined;
    if (res && res.success === false) fail("Couldn't save the field", res.error);
  };

  const toggleWatching = async () => {
    const previous = watch;
    setWatch({ watching: !previous.watching, count: previous.watching ? Math.max(0, previous.count - 1) : previous.count + 1 });
    const res = await toggleWatch(currentRef.current.id);
    if (res.success) setWatch({ watching: res.watching, count: res.count });
    else setWatch(previous);
  };

  // ---- Comments and history -------------------------------------------------
  const addNewComment = async (text: string): Promise<boolean> => {
    const content = text.trim();
    if (!content || !currentUser) return false;
    const before = currentRef.current;
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const placeholder = {
      id: tempId,
      content,
      issueId: before.id,
      authorId: currentUser.id,
      author: currentUser,
      createdAt: now,
      updatedAt: now,
    };
    publish(withCommentCountChange({ ...before, comments: [placeholder, ...(before.comments ?? [])] }, 1));
    const res = await addComment(before.id, currentUser.id, content);
    if (res.success && res.comment) {
      const latest = currentRef.current;
      publish({ ...latest, comments: (latest.comments ?? []).map((c) => (c.id === tempId ? res.comment : c)) });
      return true;
    }
    const latest = currentRef.current;
    publish(withCommentCountChange({ ...latest, comments: (latest.comments ?? []).filter((c) => c.id !== tempId) }, -1));
    fail("Couldn't add the comment", res.error);
    return false;
  };

  const removeComment = async (commentId: string) => {
    const before = currentRef.current;
    publish(withCommentCountChange({ ...before, comments: (before.comments ?? []).filter((c) => c.id !== commentId) }, -1));
    const res = await deleteComment(commentId);
    if (!res.success) {
      publish(before);
      fail("Couldn't delete the comment", res.error);
    }
  };

  const loadOlder = async (kinds: HistoryKind[]) => {
    const target = currentRef.current.id;
    setLoadingOlder(kinds);
    try {
      const pages = await Promise.all(
        kinds.map(async (kind) => {
          const beforeId = oldestLoadedId(currentRef.current, kind);
          return [kind, beforeId ? await getOlderIssueHistory(target, kind, beforeId) : []] as const;
        })
      );
      setCurrent((prev) => {
        if (prev.id !== target) return prev;
        return pages.reduce((issueSoFar, [kind, older]) => withOlderHistory(issueSoFar, kind, older as any[]), prev);
      });
    } finally {
      setLoadingOlder(null);
    }
  };

  // ---- Everything else that hangs off the issue --------------------------------
  const patch = (changes: (issue: Issue) => Partial<Issue>) => publish({ ...currentRef.current, ...changes(currentRef.current) });

  const sections = {
    onAttachmentAdded: (a: Attachment) => patch((i) => ({ attachments: [a, ...(i.attachments ?? [])] })),
    onAttachmentRemoved: (id: string) => patch((i) => ({ attachments: (i.attachments ?? []).filter((a) => a.id !== id) })),
    onIssueLinked: (link: IssueLink) => patch((i) => ({ linksAsSource: [...(i.linksAsSource ?? []), link] })),
    onIssueUnlinked: (id: string) =>
      patch((i) => ({
        linksAsSource: (i.linksAsSource ?? []).filter((l) => l.id !== id),
        linksAsTarget: (i.linksAsTarget ?? []).filter((l) => l.id !== id),
      })),
    onLabelAdded: (label: IssueLabel) =>
      patch((i) => ({ labels: [...(i.labels ?? []).filter((l) => l.labelId !== label.labelId), label] })),
    onLabelRemoved: (labelId: string) =>
      patch((i) => ({ labels: (i.labels ?? []).filter((l) => l.labelId !== labelId && l.id !== labelId) })),
    onComponentAdded: (c: IssueComponent) =>
      patch((i) => ({ components: [...(i.components ?? []).filter((x) => x.componentId !== c.componentId), c] })),
    onComponentRemoved: (componentId: string) =>
      patch((i) => ({ components: (i.components ?? []).filter((c) => c.componentId !== componentId) })),
    onEstimatesChanged: (originalEstimateSeconds: number | null, remainingEstimateSeconds: number | null) =>
      patch(() => ({ originalEstimateSeconds, remainingEstimateSeconds })),
    onWorklogAdded: (w: Worklog, remainingEstimateSeconds: number | null) =>
      patch((i) => ({ worklogs: [w, ...(i.worklogs ?? [])], remainingEstimateSeconds })),
    onWorklogRemoved: (id: string, remainingEstimateSeconds: number | null) =>
      patch((i) => ({ worklogs: (i.worklogs ?? []).filter((w) => w.id !== id), remainingEstimateSeconds })),
    onChildAdded: (child: Issue) => patch((i) => ({ children: [...(i.children ?? []), child] })),
    onChildRemoved: (id: string) => patch((i) => ({ children: (i.children ?? []).filter((c: { id: string }) => c.id !== id) })),
  };

  const pasteImage = async (file: File): Promise<ImagePasteResult> => {
    if (!permissions.canAddComment) return { success: false, error: "You don't have permission to attach files." };
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return { success: false, error: `Image too large. Maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE)}.` };
    }
    const name =
      !file.name || file.name === "image.png" || file.name === "blob" ? generatePastedImageFileName(file.type || "image/png") : file.name;
    const form = new FormData();
    form.append("file", new File([file], name, { type: file.type || "image/png" }));
    const res = await uploadAttachment(currentRef.current.id, form);
    if (res.success && res.attachment) {
      const attachment = res.attachment as unknown as Attachment;
      sections.onAttachmentAdded(attachment);
      return { success: true, url: `/api/v1/attachments/${attachment.id}`, fileName: attachment.fileName };
    }
    return { success: false, error: (res as { error?: string }).error || "Failed to upload image" };
  };

  const onDeletedRef = useRef(onIssueDeleted);
  onDeletedRef.current = onIssueDeleted;
  const remove = async (): Promise<boolean> => {
    const target = currentRef.current;
    const res = await deleteIssue(target.id);
    if (res.success) {
      onDeletedRef.current?.(target.id);
      return true;
    }
    fail(`Couldn't delete ${target.key}`, (res as { error?: string }).error);
    return false;
  };

  return {
    issue: current,
    loaded,
    project,
    projectKey,
    permissions,
    canDelete,
    isKanban,
    users,
    sprints,
    versions,
    epics,
    statuses,
    transitions,
    customFields,
    customFieldValues,
    watch,
    loadingOlder,
    actions: {
      setTitle,
      setDescription,
      setType,
      setStatus,
      setPriority,
      setAssignee,
      setParent,
      setSprint,
      setVersion,
      setStoryPoints,
      setDueDate,
      setStartDate,
      setCustomFieldValue,
      toggleWatching,
      addComment: addNewComment,
      removeComment,
      loadOlder,
      pasteImage,
      remove,
    },
    sections,
  };
}

export type IssueData = ReturnType<typeof useIssueData>;
