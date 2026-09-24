"use client";

import ColorSwatchPicker from "./ColorSwatchPicker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Project, WorkflowStatus, WorkflowStatusCategory, WorkflowTransition } from "@/types";
import {
  createWorkflowStatus,
  deleteWorkflowStatus,
  reorderWorkflowStatuses,
  setWorkflowTransition,
  updateWorkflowStatus,
  allowAllIncomingTransitions,
  clearStatusTransitions,
} from "@/lib/actions/workflows";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  Loader2,
  Plus,
  Trash2,
  Table as TableIcon,
  Network,
} from "lucide-react";
import WorkflowGraphView from "./WorkflowGraphView";

interface WorkflowSettingsTabProps {
  project: Project;
  initialStatuses: WorkflowStatus[];
  initialTransitions: WorkflowTransition[];
  canManage: boolean;
}

const CATEGORY_LABELS: Record<WorkflowStatusCategory, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export default function WorkflowSettingsTab({
  project,
  initialStatuses,
  initialTransitions,
  canManage,
}: WorkflowSettingsTabProps) {
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(
    [...initialStatuses].sort((a, b) => a.order - b.order)
  );
  const [transitions, setTransitions] = useState<WorkflowTransition[]>(initialTransitions);
  const [transitionViewMode, setTransitionViewMode] = useState<"graph" | "matrix">("graph");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addingStatus, setAddingStatus] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<WorkflowStatusCategory>("TODO");
  const [isCreating, setIsCreating] = useState(false);

  const transitionKeys = useMemo(
    () => new Set(transitions.map((t) => `${t.fromId}:${t.toId}`)),
    [transitions]
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

  // A color picker reports every step of a drag; save only where it stops.
  const pendingColors = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; color: string }>());

  // Leaving the tab mid-edit still saves the color and refreshes the cache.
  useEffect(() => {
    const colors = pendingColors.current;
    return () => {
      colors.forEach(({ timer, color }, statusId) => {
        clearTimeout(timer);
        updateWorkflowStatus(statusId, { color });
      });
      if (refreshTimer.current || colors.size > 0) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        router.refresh();
      }
    };
  }, [router]);

  const withError = async <T,>(fn: () => Promise<{ success: boolean; error?: string } & T>) => {
    setError(null);
    const res = await fn();
    if (!res.success && res.error) setError(res.error);
    if (res.success) scheduleRefresh();
    return res;
  };

  const handleColorChange = (status: WorkflowStatus, color: string) => {
    setStatuses((prev) => prev.map((s) => (s.id === status.id ? { ...s, color } : s)));
    const pending = pendingColors.current;
    const existing = pending.get(status.id);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      pending.delete(status.id);
      withError(() => updateWorkflowStatus(status.id, { color }));
    }, 300);
    pending.set(status.id, { timer, color });
  };

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    const res = await withError(() =>
      createWorkflowStatus(project.id, { name: newName.trim(), category: newCategory })
    );
    setIsCreating(false);
    if (res.success && (res as any).status) {
      setStatuses((prev) => [...prev, (res as any).status]);
      setNewName("");
      setNewCategory("TODO");
      setAddingStatus(false);
    }
  };

  const handleRename = async (status: WorkflowStatus, name: string) => {
    if (!name.trim() || name === status.name) return;
    setBusyId(status.id);
    const res = await withError(() => updateWorkflowStatus(status.id, { name: name.trim() }));
    setBusyId(null);
    if (res.success && (res as any).status) {
      setStatuses((prev) => prev.map((s) => (s.id === status.id ? (res as any).status : s)));
    }
  };

  const handleFieldChange = async (
    status: WorkflowStatus,
    patch: Partial<Pick<WorkflowStatus, "category" | "isBacklog" | "color" | "wipLimit">>
  ) => {
    setStatuses((prev) => prev.map((s) => (s.id === status.id ? { ...s, ...patch } : s)));
    const res = await withError(() => updateWorkflowStatus(status.id, patch));
    if (!res.success) {
      // Revert on failure -- the server rejected it (e.g. duplicate name).
      setStatuses((prev) => prev.map((s) => (s.id === status.id ? status : s)));
    }
  };

  const handleDelete = async (status: WorkflowStatus) => {
    if (!confirm(`Delete the "${prettifyStatusName(status.name)}" status?`)) return;
    setBusyId(status.id);
    const res = await withError(() => deleteWorkflowStatus(status.id));
    setBusyId(null);
    if (res.success) {
      setStatuses((prev) => prev.filter((s) => s.id !== status.id));
      setTransitions((prev) => prev.filter((t) => t.fromId !== status.id && t.toId !== status.id));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= statuses.length) return;
    const next = [...statuses];
    [next[index], next[target]] = [next[target], next[index]];
    setStatuses(next);
    await withError(() =>
      reorderWorkflowStatuses(
        project.id,
        next.map((s) => s.id)
      )
    );
  };

  const handleToggleTransition = async (fromId: string, toId: string, allowed: boolean) => {
    const key = `${fromId}:${toId}`;
    setTransitions((prev) =>
      allowed
        ? [...prev, { id: key, projectId: project.id, fromId, toId, createdAt: new Date().toISOString() }]
        : prev.filter((t) => !(t.fromId === fromId && t.toId === toId))
    );
    const res = await setWorkflowTransition(project.id, fromId, toId, allowed);
    if (res.success) scheduleRefresh();
    if (!res.success) {
      // Revert the optimistic toggle.
      setTransitions((prev) =>
        allowed
          ? prev.filter((t) => !(t.fromId === fromId && t.toId === toId))
          : [...prev, { id: key, projectId: project.id, fromId, toId, createdAt: new Date().toISOString() }]
      );
      if (res.error) setError(res.error);
    }
  };

  const handleAllowAllIncoming = async (toId: string) => {
    const otherStatusIds = statuses.filter((s) => s.id !== toId).map((s) => s.id);
    const newTransitions = otherStatusIds.map((fromId) => ({
      id: `${fromId}:${toId}`,
      projectId: project.id,
      fromId,
      toId,
      createdAt: new Date().toISOString(),
    }));

    // Optimistic update
    setTransitions((prev) => {
      const filtered = prev.filter((t) => t.toId !== toId);
      return [...filtered, ...newTransitions];
    });

    const res = await allowAllIncomingTransitions(project.id, toId);
    if (res.success) scheduleRefresh();
    if (!res.success && res.error) {
      setError(res.error);
    }
  };

  const handleClearTransitions = async (
    statusId: string,
    direction: "incoming" | "outgoing" | "both" = "both"
  ) => {
    // Optimistic update
    setTransitions((prev) =>
      prev.filter((t) => {
        if (direction === "incoming") return t.toId !== statusId;
        if (direction === "outgoing") return t.fromId !== statusId;
        return t.fromId !== statusId && t.toId !== statusId;
      })
    );
    const res = await clearStatusTransitions(project.id, statusId, direction);
    if (res.success) scheduleRefresh();
    if (!res.success && res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {error && (
        <div className="p-3 text-xs bg-danger-soft border border-danger/30 text-danger rounded-md font-medium">
          {error}
        </div>
      )}

      {/* Statuses */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-ink">Statuses</h3>
          {canManage && !addingStatus && (
            <button
              onClick={() => setAddingStatus(true)}
              className="text-[11px] text-accent hover:underline font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add status
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted mb-3">
          The board shows one column per non-backlog status, in this order. A backlog status is
          excluded from the board and lives in the Backlog view instead.
        </p>

        <div className="border border-subtle rounded-lg divide-y divide-subtle overflow-hidden">
          {statuses.map((status, index) => (
            <div key={status.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface">
              <div className="flex shrink-0 items-center">
                <button
                  disabled={!canManage || index === 0}
                  onClick={() => handleMove(index, -1)}
                  aria-label={`Move ${status.name} up`}
                  className="grid h-6 w-6 place-items-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={!canManage || index === statuses.length - 1}
                  onClick={() => handleMove(index, 1)}
                  aria-label={`Move ${status.name} down`}
                  className="grid h-6 w-6 place-items-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <ColorSwatchPicker
                value={status.color}
                disabled={!canManage}
                onChange={(hex) => handleColorChange(status, hex)}
                label={`Colour of ${status.name}`}
              />

              <input
                type="text"
                defaultValue={status.name}
                aria-label={`Name of ${status.name}`}
                disabled={!canManage}
                onBlur={(e) => handleRename(status, e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-xs font-semibold text-ink border border-transparent hover:border-subtle focus:border-accent rounded disabled:opacity-60"
              />

              <select
                value={status.category}
                aria-label={`Category of ${status.name}`}
                disabled={!canManage}
                onChange={(e) =>
                  handleFieldChange(status, { category: e.target.value as WorkflowStatusCategory })
                }
                className="text-[11px] bg-surface border border-subtle rounded px-1.5 py-1 text-ink disabled:opacity-60 shrink-0"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1 text-[11px] text-ink-2 shrink-0">
                <input
                  type="checkbox"
                  checked={status.isBacklog}
                  disabled={!canManage}
                  onChange={(e) => handleFieldChange(status, { isBacklog: e.target.checked })}
                  className="accent-[rgb(var(--color-accent))] disabled:opacity-60"
                />
                Backlog
              </label>

              <input
                type="number"
                min={0}
                placeholder="WIP"
                aria-label={`Work-in-progress limit for ${status.name}`}
                value={status.wipLimit ?? ""}
                disabled={!canManage}
                onChange={(e) =>
                  handleFieldChange(status, {
                    wipLimit: e.target.value === "" ? null : parseInt(e.target.value, 10),
                  })
                }
                className="w-14 px-1.5 py-1 text-[11px] border border-subtle rounded focus:border-accent disabled:opacity-60 shrink-0"
                title="WIP limit"
              />

              {canManage && (
                <button
                  onClick={() => handleDelete(status)}
                  disabled={busyId === status.id}
                  className="p-1 text-muted hover:text-danger hover:bg-danger-soft rounded shrink-0"
                  title="Delete status"
                >
                  {busyId === status.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {addingStatus && (
          <form
            onSubmit={handleAddStatus}
            className="mt-3 p-3 border border-subtle rounded-md bg-page/70 flex items-center gap-2"
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Status name, e.g. Code Review"
              className="flex-1 px-2.5 py-1.5 text-xs border border-subtle rounded focus:border-accent text-ink"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as WorkflowStatusCategory)}
              className="text-xs bg-surface border border-subtle rounded px-2 py-1.5 text-ink"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isCreating || !newName.trim()}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold rounded disabled:opacity-50 flex items-center gap-1.5"
            >
              {isCreating && <Loader2 className="w-3 h-3 animate-spin" />}
              {isCreating ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingStatus(false);
                setNewName("");
              }}
              className="px-3 py-1.5 text-ink-2 hover:bg-surface-sunk rounded text-xs font-medium"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Transitions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5 mb-0.5">
              <GitBranch className="w-3.5 h-3.5 text-accent" />
              Transitions
            </h3>
            <p className="text-[11px] text-muted">
              Configure allowed moves between statuses. An issue can only move between statuses connected by a transition arrow.
            </p>
          </div>

          {/* View Mode Switcher: Graph (Default) vs Matrix */}
          <div className="flex items-center bg-surface-sunk p-0.5 rounded border border-subtle text-xs shrink-0">
            <button
              type="button"
              onClick={() => setTransitionViewMode("graph")}
              className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                transitionViewMode === "graph"
                  ? "bg-surface text-accent shadow-2xs"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Graph View</span>
            </button>
            <button
              type="button"
              onClick={() => setTransitionViewMode("matrix")}
              className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                transitionViewMode === "matrix"
                  ? "bg-surface text-accent shadow-2xs"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Matrix View</span>
            </button>
          </div>
        </div>

        {transitionViewMode === "graph" ? (
          <WorkflowGraphView
            projectId={project.id}
            statuses={statuses}
            transitions={transitions}
            canManage={canManage}
            onToggleTransition={handleToggleTransition}
            onAllowAllIncoming={handleAllowAllIncoming}
            onClearTransitions={handleClearTransitions}
            onAddStatusClick={() => setAddingStatus(true)}
          />
        ) : (
          <div className="overflow-x-auto border border-subtle rounded-lg">
            <table className="text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-page px-3 py-2 text-left font-bold text-ink-2 border-b border-subtle">
                    From \ To
                  </th>
                  {statuses.map((to) => (
                    <th
                      key={to.id}
                      className="px-2 py-2 text-center font-bold text-ink-2 border-b border-l border-subtle whitespace-nowrap"
                    >
                      {prettifyStatusName(to.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statuses.map((from) => (
                  <tr key={from.id}>
                    <td className="sticky left-0 bg-surface px-3 py-2 font-semibold text-ink border-b border-subtle whitespace-nowrap">
                      {prettifyStatusName(from.name)}
                    </td>
                    {statuses.map((to) => {
                      const isSelf = from.id === to.id;
                      const checked = transitionKeys.has(`${from.id}:${to.id}`);
                      return (
                        <td
                          key={to.id}
                          className="px-2 py-2 text-center border-b border-l border-subtle"
                        >
                          {isSelf ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canManage}
                              onChange={(e) =>
                                handleToggleTransition(from.id, to.id, e.target.checked)
                              }
                              className="accent-[rgb(var(--color-accent))] disabled:opacity-60"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
