"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Project, WorkflowStatus, WorkflowTransition } from "@/types";
import {
  allowEveryTransition,
  createWorkflowStatus,
  deleteWorkflowStatus,
  reorderWorkflowStatuses,
  setStatusTransitions,
  setWorkflowTransition,
  updateWorkflowStatus,
} from "@/lib/actions/workflows";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import {
  boardLayout,
  everyTransition,
  moveItem,
  statusFlows,
  statusWarnings,
  transitionKey,
  withStatusTransitions,
} from "@/lib/workflowEditor";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Dialog";
import { Button, IconButton } from "@/components/ui/Button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { Tooltip } from "@/components/ui/Popover";
import { cn } from "@/components/ui/cn";
import WorkflowStatusSheet, { CATEGORY_OPTIONS, StatusDraft } from "./WorkflowStatusSheet";

interface WorkflowSettingsTabProps {
  project: Project;
  initialStatuses: WorkflowStatus[];
  initialTransitions: WorkflowTransition[];
  canManage: boolean;
}

type Editing = { kind: "edit"; id: string } | { kind: "new"; n: number } | null;

const categoryLabel = (category: string) => CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;

const now = () => new Date().toISOString();

export default function WorkflowSettingsTab({
  project,
  initialStatuses,
  initialTransitions,
  canManage,
}: WorkflowSettingsTabProps) {
  const [confirm, confirmDialog] = useConfirm();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(() =>
    [...initialStatuses].sort((a, b) => a.order - b.order)
  );
  const [transitions, setTransitions] = useState<WorkflowTransition[]>(initialTransitions);
  const [editing, setEditing] = useState<Editing>(null);
  const newCount = useRef(0);

  const flows = useMemo(() => statusFlows(statuses, transitions), [statuses, transitions]);
  const keys = useMemo(() => new Set(transitions.map((t) => transitionKey(t.fromId, t.toId))), [transitions]);
  const { columns, backlog } = useMemo(() => boardLayout(statuses), [statuses]);
  const allAllowed = statuses.length > 1 && transitions.length >= statuses.length * (statuses.length - 1);
  const nameOf = useCallback(
    (id: string) => prettifyStatusName(statuses.find((s) => s.id === id)?.name),
    [statuses]
  );

  // The workflow actions return as soon as they've saved, without re-rendering
  // the page. Other views (board, backlog, reports) keep their data in the
  // router cache, so refresh it once in the background after edits settle.
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 800);
  }, [router]);
  useEffect(
    () => () => {
      // Leaving the section mid-edit still refreshes the cache.
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        router.refresh();
      }
    },
    [router]
  );

  const fail = (title: string, description?: string) => toast({ title, description, tone: "danger" });

  const toTransitions = (pairs: { fromId: string; toId: string }[]): WorkflowTransition[] =>
    pairs.map((p) => ({ id: transitionKey(p.fromId, p.toId), projectId: project.id, createdAt: now(), ...p }));

  // ── Statuses ──────────────────────────────────────────────────────────

  const saveStatus = async (status: WorkflowStatus | undefined, draft: StatusDraft): Promise<string | null> => {
    let saved: WorkflowStatus;
    if (!status) {
      const res = await createWorkflowStatus(project.id, {
        name: draft.name,
        category: draft.category,
        color: draft.color,
        isBacklog: draft.isBacklog,
        wipLimit: draft.wipLimit,
      });
      if (!res.success) return res.error ?? "The status couldn't be added.";
      saved = res.status as unknown as WorkflowStatus;
      setStatuses((prev) => [...prev, saved]);
    } else {
      const patch: Parameters<typeof updateWorkflowStatus>[1] = {};
      if (draft.name !== prettifyStatusName(status.name) && draft.name !== status.name) patch.name = draft.name;
      if (draft.category !== status.category) patch.category = draft.category;
      if (draft.color.toLowerCase() !== status.color.toLowerCase()) patch.color = draft.color;
      if (draft.isBacklog !== status.isBacklog) patch.isBacklog = draft.isBacklog;
      if (draft.wipLimit !== status.wipLimit) patch.wipLimit = draft.wipLimit;
      saved = status;
      if (Object.keys(patch).length > 0) {
        const res = await updateWorkflowStatus(status.id, patch);
        if (!res.success) return res.error ?? "The status couldn't be saved.";
        saved = res.status as unknown as WorkflowStatus;
        setStatuses((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      }
    }

    const flow = flows.get(saved.id);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
    if (!status || !flow || !same(flow.to, draft.to) || !same(flow.from, draft.from)) {
      const res = await setStatusTransitions(project.id, saved.id, { to: draft.to, from: draft.from });
      if (!res.success) {
        scheduleRefresh();
        return `${status ? "Saved" : "Added"} ${prettifyStatusName(saved.name)}, but its moves weren't: ${res.error}`;
      }
      setTransitions((prev) => toTransitions(withStatusTransitions(prev, saved.id, draft.to, draft.from)));
    }

    scheduleRefresh();
    setEditing(null);
    toast({ title: `${status ? "Saved" : "Added"} ${prettifyStatusName(saved.name)}`, tone: "success" });
    return null;
  };

  const handleDelete = async (status: WorkflowStatus) => {
    const label = prettifyStatusName(status.name);
    const ok = await confirm({
      title: `Delete ${label}?`,
      description: "Its board column goes, and so do the moves in and out of it. A status that still holds issues can't be deleted.",
      confirmLabel: "Delete status",
    });
    if (!ok) return;
    const res = await deleteWorkflowStatus(status.id);
    if (!res.success) {
      fail(`Couldn't delete ${label}`, res.error);
      return;
    }
    setEditing(null);
    setStatuses((prev) => prev.filter((s) => s.id !== status.id));
    setTransitions((prev) => prev.filter((t) => t.fromId !== status.id && t.toId !== status.id));
    scheduleRefresh();
    toast({ title: `Deleted ${label}` });
  };

  const reorder = async (from: number, to: number) => {
    const previous = statuses;
    const next = moveItem(statuses, from, to).map((s, order) => ({ ...s, order }));
    if (next === previous) return;
    setStatuses(next);
    const res = await reorderWorkflowStatuses(
      project.id,
      next.map((s) => s.id)
    );
    if (!res.success) {
      setStatuses(previous);
      fail("Couldn't reorder the statuses", res.error);
      return;
    }
    scheduleRefresh();
  };

  const onDragEnd = (result: DropResult) => {
    if (result.destination) reorder(result.source.index, result.destination.index);
  };

  // ── Moves ─────────────────────────────────────────────────────────────

  const toggleMove = async (fromId: string, toId: string, allowed: boolean) => {
    const key = transitionKey(fromId, toId);
    const apply = (on: boolean) =>
      setTransitions((prev) =>
        on
          ? prev.some((t) => t.id === key || (t.fromId === fromId && t.toId === toId))
            ? prev
            : [...prev, ...toTransitions([{ fromId, toId }])]
          : prev.filter((t) => !(t.fromId === fromId && t.toId === toId))
      );
    apply(allowed);
    const res = await setWorkflowTransition(project.id, fromId, toId, allowed);
    if (!res.success) {
      apply(!allowed);
      fail("Couldn't change that move", res.error);
      return;
    }
    scheduleRefresh();
  };

  const allowEverything = async () => {
    const previous = transitions;
    setTransitions(toTransitions(everyTransition(statuses)));
    const res = await allowEveryTransition(project.id);
    if (!res.success) {
      setTransitions(previous);
      fail("Couldn't allow every move", res.error);
      return;
    }
    scheduleRefresh();
  };

  const editingStatus = editing?.kind === "edit" ? statuses.find((s) => s.id === editing.id) : undefined;
  const editingFlow = editingStatus ? flows.get(editingStatus.id) : undefined;
  const allIds = statuses.map((s) => s.id);

  return (
    <div className="flex w-full flex-col gap-8">
      {confirmDialog}

      {/* The board, as the statuses make it */}
      <section aria-labelledby="workflow-board-heading" className="rounded-card border border-subtle bg-surface-sunk/60 p-4">
        <h3 id="workflow-board-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          How issues flow
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {backlog.length > 0 && (
            <>
              <span className="flex flex-wrap items-center gap-1.5 rounded-control border border-dashed border-strong px-2 py-1">
                {backlog.map((s) => (
                  <StatusLozenge key={s.id} label={prettifyStatusName(s.name)} color={s.color} />
                ))}
              </span>
              {columns.length > 0 && <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />}
            </>
          )}
          {columns.map((s, i) => (
            <React.Fragment key={s.id}>
              <span className="flex items-center gap-1.5 rounded-control border border-subtle bg-surface px-2 py-1">
                <StatusLozenge label={prettifyStatusName(s.name)} color={s.color} />
                {s.wipLimit != null && <span className="text-[11px] tabular-nums text-muted">max {s.wipLimit}</span>}
              </span>
              {i < columns.length - 1 && <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {columns.length === 0
            ? "No status is shown on the board yet."
            : `The board shows ${columns.length} column${columns.length === 1 ? "" : "s"}, left to right, in the order of the list below.`}
          {backlog.length > 0 && " Statuses in the dashed box stay in the Backlog view."}
        </p>
      </section>

      {/* Statuses */}
      <section aria-labelledby="workflow-statuses-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="workflow-statuses-heading" className="text-sm font-semibold text-ink">
              Statuses <span className="font-normal text-muted">{statuses.length}</span>
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {canManage
                ? "Drag to reorder. Select a status to rename it, recolour it or change where issues in it can go."
                : "Select a status to see where issues in it can go."}
            </p>
          </div>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setEditing({ kind: "new", n: ++newCount.current })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add status
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-card border border-subtle bg-surface">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[1.25rem_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,2fr)_2rem] items-center gap-3 border-b border-subtle bg-surface-sunk/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted md:grid"
          >
            <span />
            <span>Status</span>
            <span>Category</span>
            <span>Board</span>
            <span>Can move to</span>
            <span />
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="workflow-statuses">
              {(provided) => (
                <ol ref={provided.innerRef} {...provided.droppableProps} aria-label="Statuses, in board order">
                  {statuses.map((status, index) => {
                    const flow = flows.get(status.id);
                    const warnings = statusWarnings(status, flow, statuses.length);
                    const label = prettifyStatusName(status.name);
                    const column = columns.findIndex((c) => c.id === status.id);
                    return (
                      <Draggable key={status.id} draggableId={status.id} index={index} isDragDisabled={!canManage}>
                        {(drag, snapshot) => (
                          <li
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            onClick={() => setEditing({ kind: "edit", id: status.id })}
                            className={cn(
                              "grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1 border-b border-subtle bg-surface px-3 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-surface-sunk",
                              "md:grid-cols-[1.25rem_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,2fr)_2rem]",
                              snapshot.isDragging && "rounded-control border border-accent shadow-overlay"
                            )}
                          >
                            <span
                              {...(canManage ? drag.dragHandleProps : {})}
                              aria-label={canManage ? `Drag ${label}` : undefined}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "inline-flex h-7 w-5 items-center justify-center text-muted",
                                canManage ? "cursor-grab hover:text-ink active:cursor-grabbing" : "opacity-40"
                              )}
                            >
                              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>

                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing({ kind: "edit", id: status.id });
                                }}
                                aria-label={canManage ? `Edit ${label}` : `View ${label}`}
                                className="max-w-full rounded-full"
                              >
                                <StatusLozenge label={label} color={status.color} />
                              </button>
                              {warnings.map((w) => (
                                <span key={w} className="inline-flex items-center gap-1 text-xs text-warning">
                                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                  {w}
                                </span>
                              ))}
                            </div>

                            <span className="hidden text-xs text-ink-2 md:block">{categoryLabel(status.category)}</span>
                            <span className="hidden text-xs text-ink-2 md:block">
                              {status.isBacklog ? (
                                <span className="text-muted">Backlog only</span>
                              ) : (
                                <>
                                  Column {column + 1}
                                  {status.wipLimit != null && <span className="text-muted"> · max {status.wipLimit}</span>}
                                </>
                              )}
                            </span>
                            <span className="col-start-2 min-w-0 md:col-start-auto">
                              <MovesSummary to={flow?.to ?? []} toAll={flow?.toAll ?? false} statuses={statuses} />
                            </span>

                            <span className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto" onClick={(e) => e.stopPropagation()}>
                              {canManage && (
                                <Menu>
                                  <MenuTrigger asChild>
                                    <IconButton size="sm" label={`Actions for ${label}`} icon={<MoreHorizontal />} />
                                  </MenuTrigger>
                                  <MenuContent align="end">
                                    <MenuItem icon={<Pencil />} onSelect={() => setEditing({ kind: "edit", id: status.id })}>
                                      Edit status
                                    </MenuItem>
                                    <MenuItem icon={<ArrowUp />} disabled={index === 0} onSelect={() => reorder(index, index - 1)}>
                                      Move up
                                    </MenuItem>
                                    <MenuItem
                                      icon={<ArrowDown />}
                                      disabled={index === statuses.length - 1}
                                      onSelect={() => reorder(index, index + 1)}
                                    >
                                      Move down
                                    </MenuItem>
                                    <MenuSeparator />
                                    <MenuItem icon={<Trash2 />} danger onSelect={() => handleDelete(status)}>
                                      Delete status
                                    </MenuItem>
                                  </MenuContent>
                                </Menu>
                              )}
                            </span>
                          </li>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </ol>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </section>

      {/* Moves */}
      <section aria-labelledby="workflow-moves-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="workflow-moves-heading" className="text-sm font-semibold text-ink">
              Allowed moves
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {allAllowed
                ? "Issues can move from any status to any other. Untick a box to rule a move out."
                : "Each row is where an issue is now; ticked boxes are the statuses it can move to."}
            </p>
          </div>
          {canManage && statuses.length > 1 && (
            <Button size="sm" disabled={allAllowed} onClick={allowEverything}>
              Allow every move
            </Button>
          )}
        </div>

        <div
          role="region"
          aria-label="Allowed moves table"
          tabIndex={0}
          className="overflow-x-auto rounded-card border border-subtle bg-surface"
        >
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">
              Allowed moves. Rows are the status an issue is in; columns are where it can move to.
            </caption>
            <thead>
              <tr className="bg-surface-sunk/60">
                <th
                  scope="col"
                  className="sticky left-0 z-10 whitespace-nowrap border-b border-subtle bg-surface-sunk px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted"
                >
                  From <ArrowRight className="inline h-3 w-3" aria-hidden="true" /> to
                </th>
                {statuses.map((to) => (
                  <th key={to.id} scope="col" className="border-b border-l border-subtle px-2 py-2 text-center font-normal">
                    <StatusLozenge label={prettifyStatusName(to.name)} color={to.color} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statuses.map((from) => (
                <tr key={from.id} className="hover:bg-surface-sunk/50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-b border-subtle bg-surface px-3 py-1.5 text-left font-normal"
                  >
                    <StatusLozenge label={prettifyStatusName(from.name)} color={from.color} />
                  </th>
                  {statuses.map((to) => (
                    <td key={to.id} className="border-b border-l border-subtle px-2 py-1.5 text-center">
                      {from.id === to.id ? (
                        <span className="text-muted">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Same status</span>
                        </span>
                      ) : (
                        <Tooltip content={`${nameOf(from.id)} → ${nameOf(to.id)}`}>
                          <input
                            type="checkbox"
                            checked={keys.has(transitionKey(from.id, to.id))}
                            disabled={!canManage}
                            aria-label={`Move from ${nameOf(from.id)} to ${nameOf(to.id)}`}
                            onChange={(e) => toggleMove(from.id, to.id, e.target.checked)}
                            className="h-4 w-4 cursor-pointer rounded-[4px] accent-[rgb(var(--color-accent))] disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </Tooltip>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing?.kind === "new" && (
          <WorkflowStatusSheet
            key={`new-${editing.n}`}
            statuses={statuses}
            initialTo={allIds}
            initialFrom={allIds}
            canManage={canManage}
            onSave={(draft) => saveStatus(undefined, draft)}
            onClose={() => setEditing(null)}
          />
        )}
        {editingStatus && (
          <WorkflowStatusSheet
            key={editingStatus.id}
            status={editingStatus}
            statuses={statuses}
            initialTo={editingFlow?.to ?? []}
            initialFrom={editingFlow?.from ?? []}
            canManage={canManage}
            onSave={(draft) => saveStatus(editingStatus, draft)}
            onDelete={() => handleDelete(editingStatus)}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

/** Where issues in a status can go, as lozenges; "Any status" when that's all of them. */
function MovesSummary({ to, toAll, statuses }: { to: string[]; toAll: boolean; statuses: WorkflowStatus[] }) {
  if (toAll) return <span className="text-xs text-ink-2">Any status</span>;
  if (to.length === 0) return <span className="text-xs text-muted">Nowhere</span>;
  const shown = to.slice(0, 3);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((id) => {
        const s = statuses.find((x) => x.id === id);
        return s ? <StatusLozenge key={id} label={prettifyStatusName(s.name)} color={s.color} /> : null;
      })}
      {to.length > shown.length && <span className="text-xs text-muted">+{to.length - shown.length} more</span>}
    </span>
  );
}
