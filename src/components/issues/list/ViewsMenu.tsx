"use client";

import React, { useState } from "react";
import { ChevronDown, Layers, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { cn } from "@/components/ui/cn";
import type { ViewDefinition } from "@/lib/issueQuery";

type NameDialog = { mode: "create" } | { mode: "rename"; view: ViewDefinition } | { mode: "delete"; view: ViewDefinition } | null;

/**
 * Which view the page shows. The six presets are built-in views; people can
 * save the current filters, sort and columns as views of their own.
 */
export default function ViewsMenu({
  builtIn,
  saved,
  active,
  modified,
  canSave,
  onSelect,
  onCreate,
  onSaveChanges,
  onRename,
  onDelete,
}: {
  builtIn: ViewDefinition[];
  saved: ViewDefinition[];
  active: ViewDefinition | null;
  /** The page no longer matches the active view. */
  modified: boolean;
  canSave: boolean;
  onSelect: (view: ViewDefinition) => void;
  onCreate: (name: string) => Promise<string | null>;
  onSaveChanges: (view: ViewDefinition) => void;
  onRename: (view: ViewDefinition, name: string) => Promise<string | null>;
  onDelete: (view: ViewDefinition) => Promise<string | null>;
}) {
  const [dialog, setDialog] = useState<NameDialog>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (next: NameDialog) => {
    setDialog(next);
    setError(null);
    setName(next?.mode === "rename" ? next.view.name : "");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!dialog) return;
    setBusy(true);
    const problem =
      dialog.mode === "create" ? await onCreate(name) : dialog.mode === "rename" ? await onRename(dialog.view, name) : await onDelete(dialog.view);
    setBusy(false);
    if (problem) setError(problem);
    else setDialog(null);
  };

  const activeSaved = active && !active.builtIn ? active : null;
  const label = active ? active.name : "Custom view";

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 max-w-[16rem] items-center gap-2 rounded-control border border-subtle bg-surface px-2.5 text-[13px] font-medium text-ink hover:border-strong"
          >
            <Layers className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{label}</span>
            {modified && active && (
              <span className="shrink-0 rounded-full bg-warning-soft px-1.5 text-[11px] font-medium leading-4 text-warning">Edited</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">, choose a view</span>
          </button>
        </MenuTrigger>
        <MenuContent className="max-h-[70vh] w-64 overflow-y-auto">
          <MenuLabel>Views</MenuLabel>
          {builtIn.map((v) => (
            <MenuCheckboxItem key={v.id} checked={active?.id === v.id} onCheckedChange={() => onSelect(v)}>
              {v.name}
            </MenuCheckboxItem>
          ))}
          {saved.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Your views</MenuLabel>
              {saved.map((v) => (
                <MenuCheckboxItem key={v.id} checked={active?.id === v.id} onCheckedChange={() => onSelect(v)}>
                  <span className="truncate">{v.name}</span>
                </MenuCheckboxItem>
              ))}
            </>
          )}
          {canSave && (
            <>
              <MenuSeparator />
              {activeSaved && modified && (
                <MenuItem icon={<Save aria-hidden="true" />} onSelect={() => onSaveChanges(activeSaved)}>
                  Save changes to “{activeSaved.name}”
                </MenuItem>
              )}
              <MenuItem icon={<Save aria-hidden="true" />} onSelect={() => open({ mode: "create" })}>
                Save as a new view…
              </MenuItem>
              {activeSaved && (
                <>
                  <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => open({ mode: "rename", view: activeSaved })}>
                    Rename…
                  </MenuItem>
                  <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => open({ mode: "delete", view: activeSaved })}>
                    Delete view…
                  </MenuItem>
                </>
              )}
            </>
          )}
        </MenuContent>
      </Menu>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && (
          <DialogContent
            size="sm"
            title={dialog.mode === "create" ? "Save as a new view" : dialog.mode === "rename" ? "Rename the view" : `Delete “${dialog.view.name}”?`}
            description={
              dialog.mode === "create"
                ? "Saves these filters, the sort and the columns. Only you see your views."
                : dialog.mode === "delete"
                  ? "The issues aren't affected, only the saved view."
                  : undefined
            }
            footer={
              <>
                <Button onClick={() => setDialog(null)}>Cancel</Button>
                <Button
                  type={dialog.mode === "delete" ? "button" : "submit"}
                  form={dialog.mode === "delete" ? undefined : "view-name-form"}
                  onClick={dialog.mode === "delete" ? () => submit() : undefined}
                  variant={dialog.mode === "delete" ? "danger" : "primary"}
                  loading={busy}
                >
                  {dialog.mode === "create" ? "Save view" : dialog.mode === "rename" ? "Rename" : "Delete view"}
                </Button>
              </>
            }
          >
            {dialog.mode === "delete" ? (
              error && (
                <p role="alert" className="text-[13px] text-danger">
                  {error}
                </p>
              )
            ) : (
              <form id="view-name-form" onSubmit={submit}>
                <Field label="Name" error={error ?? undefined} required>
                  <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={cn(error && "border-danger")} />
                </Field>
              </form>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
