"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { WorkflowStatus, WorkflowStatusCategory } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { defaultStatusColor, isDefaultStatusColor } from "@/lib/statusColors";
import { SheetContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Checkbox, Switch } from "@/components/ui/Checkbox";
import { Segmented } from "@/components/ui/Segmented";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import ColorSwatchPicker from "./ColorSwatchPicker";

export const CATEGORY_OPTIONS: { value: WorkflowStatusCategory; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

export interface StatusDraft {
  name: string;
  category: WorkflowStatusCategory;
  color: string;
  isBacklog: boolean;
  wipLimit: number | null;
  /** Statuses an issue in this one can move to. */
  to: string[];
  /** Statuses an issue can arrive from. */
  from: string[];
}

interface WorkflowStatusSheetProps {
  /** The status being edited; none when adding one. */
  status?: WorkflowStatus;
  /** Every status in the workflow, in order. */
  statuses: WorkflowStatus[];
  /** The status's moves now; for a new status, every other status both ways. */
  initialTo: string[];
  initialFrom: string[];
  canManage: boolean;
  /** Saves the draft and resolves to an error message, or null when it saved. */
  onSave: (draft: StatusDraft) => Promise<string | null>;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Everything about one status in one place: its name, category, colour, where
 * it sits on the board, and the moves in and out of it. Changes apply on Save.
 * Render it inside a <Sheet>, keyed by the status, so each opening starts fresh.
 */
export default function WorkflowStatusSheet({
  status,
  statuses,
  initialTo,
  initialFrom,
  canManage,
  onSave,
  onDelete,
  onClose,
}: WorkflowStatusSheetProps) {
  const isNew = !status;
  // Shown as it reads on the board ("In Progress", not IN_PROGRESS); saving an
  // untouched name leaves the stored one alone.
  const [name, setName] = useState(status ? prettifyStatusName(status.name) : "");
  const [category, setCategory] = useState<WorkflowStatusCategory>(status?.category ?? "IN_PROGRESS");
  const [color, setColor] = useState(status?.color ?? defaultStatusColor("IN_PROGRESS"));
  const [colorChosen, setColorChosen] = useState(status ? !isDefaultStatusColor(status.color, status.category) : false);
  const [onBoard, setOnBoard] = useState(status ? !status.isBacklog : true);
  const [wip, setWip] = useState(status?.wipLimit != null ? String(status.wipLimit) : "");
  const [to, setTo] = useState<string[]>(initialTo);
  const [from, setFrom] = useState<string[]>(initialFrom);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const others = statuses.filter((s) => s.id !== status?.id);
  const title = isNew ? "Add status" : canManage ? `Edit ${prettifyStatusName(status.name)}` : prettifyStatusName(status.name);

  const changeCategory = (next: WorkflowStatusCategory) => {
    setCategory(next);
    // A colour nobody picked follows the category, as it does on the server.
    if (!colorChosen) setColor(defaultStatusColor(next));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!name.trim()) {
      setNameError("Give the status a name.");
      return;
    }
    const limit = wip.trim() === "" ? null : Number(wip);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      setError("A work-in-progress limit is a whole number of 1 or more, or empty for none.");
      return;
    }
    setSaving(true);
    setError(null);
    setNameError(null);
    const failure = await onSave({
      name: name.trim(),
      category,
      color,
      isBacklog: !onBoard,
      wipLimit: onBoard ? limit : status?.wipLimit ?? null,
      to,
      from,
    });
    setSaving(false);
    if (failure) setError(failure);
  };

  return (
    <SheetContent
      title={title}
      description={
        isNew
          ? "A new board column or backlog stage, and the moves in and out of it."
          : "Its name, where it appears, and where issues in it can go."
      }
      className="sm:max-w-lg"
      footer={
        <>
          {!isNew && canManage && onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-danger" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete status
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            {canManage ? "Cancel" : "Close"}
          </Button>
          {canManage && (
            <Button size="sm" variant="primary" type="submit" form="workflow-status-form" loading={saving}>
              {isNew ? "Add status" : "Save changes"}
            </Button>
          )}
        </>
      }
      onOpenAutoFocus={(e) => {
        // Straight to the name when adding; otherwise the panel itself.
        if (!isNew) e.preventDefault();
      }}
    >
      <form id="workflow-status-form" onSubmit={save} className="flex flex-col gap-5 pb-2">
        {error && (
          <p role="alert" className="rounded-card bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <Field label="Name" required error={nameError} hint={isNew ? "As it reads on the board, e.g. In review." : undefined}>
          <div className="flex items-center gap-2">
            <ColorSwatchPicker
              value={color}
              disabled={!canManage}
              label="Colour"
              onChange={(hex) => {
                setColor(hex);
                setColorChosen(true);
              }}
            />
            <Input
              value={name}
              autoFocus={isNew}
              disabled={!canManage}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-xs font-medium text-ink-2">
            Category
          </span>
          {/* A fieldset, so disabling it disables every button in the group. */}
          <fieldset disabled={!canManage} className="min-w-0">
            <Segmented label="Category" options={CATEGORY_OPTIONS} value={category} onChange={changeCategory} />
          </fieldset>
          <p className="text-xs text-muted">
            {category === "DONE"
              ? "Issues here count as finished in reports, releases and sprint totals."
              : category === "IN_PROGRESS"
                ? "Work that has started. Its issues count as in progress in reports."
                : "Work that hasn't started yet."}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-subtle p-3">
          <Switch
            label="Show as a column on the board"
            checked={onBoard}
            disabled={!canManage}
            onCheckedChange={setOnBoard}
          />
          <p className="-mt-1.5 pl-11 text-xs text-muted">
            {onBoard
              ? "Its issues appear in their own column, in the order of the status list."
              : "Its issues stay in the Backlog view until they move to a board status."}
          </p>
          {onBoard && (
            <Field
              label="Work-in-progress limit"
              hint="The column warns when it holds more issues than this. Leave empty for no limit."
              className="pl-11"
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={wip}
                disabled={!canManage}
                onChange={(e) => setWip(e.target.value)}
                className="w-28"
              />
            </Field>
          )}
        </div>

        {others.length > 0 && (
          <>
            <MovesFieldset
              legend={isNew ? "Issues in it can move to" : `Issues in ${prettifyStatusName(status.name)} can move to`}
              statuses={others}
              selected={to}
              onChange={setTo}
              disabled={!canManage}
            />
            <MovesFieldset
              legend={isNew ? "Issues can arrive from" : `Issues can arrive in ${prettifyStatusName(status.name)} from`}
              statuses={others}
              selected={from}
              onChange={setFrom}
              disabled={!canManage}
            />
          </>
        )}
      </form>

    </SheetContent>
  );
}

function MovesFieldset({
  legend,
  statuses,
  selected,
  onChange,
  disabled,
}: {
  legend: string;
  statuses: WorkflowStatus[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const all = selected.length === statuses.length;
  return (
    <fieldset disabled={disabled} className="min-w-0">
      {/* The legend stays the fieldset's first child, which is what names the group. */}
      <legend className="float-left text-xs font-medium text-ink-2">{legend}</legend>
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange(all ? [] : statuses.map((s) => s.id))}
          className="float-right rounded-control px-1 text-xs font-medium text-accent hover:underline"
        >
          {all ? "Clear all" : "Select all"}
        </button>
      )}
      <div className="clear-both grid grid-cols-1 gap-1 pt-2 sm:grid-cols-2">
        {statuses.map((s) => (
          <Checkbox
            key={s.id}
            checked={selected.includes(s.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))
            }
            className="min-h-8 rounded-control px-2 hover:bg-surface-sunk"
            label={<StatusLozenge label={prettifyStatusName(s.name)} color={s.color} />}
          />
        ))}
      </div>
    </fieldset>
  );
}
