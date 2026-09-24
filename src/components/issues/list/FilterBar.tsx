"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Code2, Plus, Search, X } from "lucide-react";
import type { User } from "@/types";
import UserAvatar from "@/components/common/UserAvatar";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { cn } from "@/components/ui/cn";
import { activeFilterCount, describeExtra, emptyFilters, ME, NONE, OPEN_SPRINTS, type ChipField, type IssueFilters } from "@/lib/issueQuery";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { Tooltip } from "@/components/ui/Popover";

export interface FilterOptions {
  statuses: { name: string; color?: string | null }[];
  users: User[];
  sprints: { name: string; status: string }[];
  versions: string[];
  labels: string[];
  projects: { key: string; name: string }[];
  signedIn: boolean;
}

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

const chip =
  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5";
const chipIdle = "border-subtle bg-surface text-ink-2 hover:border-strong hover:text-ink";
const chipActive = "border-accent/40 bg-accent-soft text-accent";

const LABELS: Record<ChipField, string> = {
  type: "Type",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  reporter: "Reporter",
  sprint: "Sprint",
  version: "Fix version",
  label: "Label",
};
const ALWAYS: ChipField[] = ["status", "assignee", "type", "priority"];
const MORE: ChipField[] = ["reporter", "sprint", "version", "label"];

const TYPES = ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"] as const;
const PRIORITIES = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as const;
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function optionsFor(field: ChipField, o: FilterOptions): Option[] {
  const people = (withNone: boolean): Option[] => [
    ...(o.signedIn ? [{ value: ME, label: "Me" }] : []),
    ...(withNone ? [{ value: NONE, label: "Unassigned", icon: <span aria-hidden="true" className="h-4 w-4 rounded-full border border-dashed border-strong" /> }] : []),
    ...o.users.map((u) => ({ value: u.id, label: u.name, icon: <UserAvatar user={u} size="xs" /> })),
  ];
  switch (field) {
    case "type":
      return TYPES.map((t) => ({ value: t, label: titleCase(t), icon: <IssueTypeIcon type={t} className="h-4 w-4" /> }));
    case "priority":
      return PRIORITIES.map((p) => ({ value: p, label: titleCase(p), icon: <PriorityIcon priority={p} className="h-4 w-4" /> }));
    case "status":
      return o.statuses.map((s) => ({
        value: s.name,
        label: prettifyStatusName(s.name),
        icon: <span aria-hidden="true" className="h-2 w-2 rounded-full bg-strong" style={s.color ? { backgroundColor: s.color } : undefined} />,
      }));
    case "assignee":
      return people(true);
    case "reporter":
      return people(false);
    case "sprint":
      return [
        { value: OPEN_SPRINTS, label: "Open sprints" },
        { value: NONE, label: "Backlog (no sprint)" },
        ...o.sprints.filter((s) => s.status !== "COMPLETED").map((s) => ({ value: s.name, label: s.name })),
      ];
    case "version":
      return [{ value: NONE, label: "No version" }, ...o.versions.map((v) => ({ value: v, label: v }))];
    case "label":
      return o.labels.map((l) => ({ value: l, label: l }));
  }
}

/** Words for a chip's values: "Bug", "Me", or "3". */
function summary(values: string[], options: Option[]): string {
  if (values.length !== 1) return String(values.length);
  return options.find((o) => o.value === values[0])?.label ?? values[0];
}

function ChipMenu({
  field,
  values,
  options,
  onChange,
  open,
  onOpenChange,
}: {
  field: ChipField;
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const active = values.length > 0;
  const label = LABELS[field];
  // Values the menu doesn't list (a sprint since closed, a name typed in TQL) stay choosable.
  const all: Option[] = [...options, ...values.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))];
  return (
    <span className={cn("inline-flex items-center rounded-full", active && "bg-accent-soft")}>
      <Menu open={open} onOpenChange={onOpenChange}>
        <MenuTrigger asChild>
          <button type="button" className={cn(chip, active ? cn(chipActive, "rounded-r-none border-r-0 pr-1.5") : chipIdle)}>
            {active ? `${label}: ${summary(values, all)}` : label}
            <ChevronDown aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent className="max-h-80 overflow-y-auto">
          {all.length === 0 && <p className="px-2 py-1.5 text-xs text-ink-2">Nothing to choose from yet.</p>}
          {all.map((o) => (
            <MenuCheckboxItem
              key={o.value}
              checked={values.includes(o.value)}
              onCheckedChange={() => onChange(values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value])}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="flex items-center gap-2">
                {o.icon}
                {o.label}
              </span>
            </MenuCheckboxItem>
          ))}
        </MenuContent>
      </Menu>
      {active && (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label={`Remove the ${label.toLowerCase()} filter`}
          className={cn(chip, chipActive, "rounded-l-none border-l-0 px-1.5 hover:bg-accent/15")}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/**
 * The Issues page's filters as one row of chips. Every chip writes TQL; "Edit
 * as TQL" shows the whole query, and conditions the chips can't show appear
 * as chips of their own.
 */
export default function FilterBar({
  filters,
  onChange,
  options,
  onEditTQL,
}: {
  filters: IssueFilters;
  onChange: (next: IssueFilters) => void;
  options: FilterOptions;
  onEditTQL: () => void;
}) {
  const [openField, setOpenField] = useState<ChipField | null>(null);
  const [pinned, setPinned] = useState<ChipField[]>([]);
  const [text, setText] = useState(filters.text);
  const set = (patch: Partial<IssueFilters>) => onChange({ ...filters, ...patch });

  // Typing waits a moment before it filters; a view or TQL change replaces it.
  useEffect(() => setText(filters.text), [filters.text]);
  useEffect(() => {
    if (text === filters.text) return;
    const timer = setTimeout(() => onChange({ ...filters, text }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text starts this
  }, [text]);

  // Kanban projects have no sprints, and a project without releases has no versions to pick.
  const offered = MORE.filter((f) => (f !== "sprint" || options.sprints.length > 0) && (f !== "version" || options.versions.length > 0));
  const shown = [...ALWAYS, ...MORE.filter((f) => filters[f].length > 0 || pinned.includes(f))];
  const addable = offered.filter((f) => !shown.includes(f));
  const project = options.projects.find((p) => p.key === filters.projectKey);

  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search issues"
          placeholder="Search keys, titles, descriptions"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-7 w-full rounded-full border border-subtle bg-surface pl-8 pr-3 text-xs text-ink placeholder:text-muted hover:border-strong focus:border-accent"
        />
      </div>

      {options.projects.length > 1 && (
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={cn(chip, filters.projectKey ? chipIdle : chipActive)}>
              {project ? project.name : "All projects"}
              <ChevronDown aria-hidden="true" />
            </button>
          </MenuTrigger>
          <MenuContent className="max-h-80 overflow-y-auto">
            <MenuLabel>Project</MenuLabel>
            <MenuCheckboxItem checked={!filters.projectKey} onCheckedChange={() => set({ projectKey: null })}>
              All projects
            </MenuCheckboxItem>
            {options.projects.map((p) => (
              <MenuCheckboxItem key={p.key} checked={filters.projectKey === p.key} onCheckedChange={() => set({ projectKey: p.key })}>
                {p.name}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </Menu>
      )}

      {shown.map((field) => (
        <ChipMenu
          key={field}
          field={field}
          values={filters[field]}
          options={optionsFor(field, options)}
          onChange={(values) => set({ [field]: values })}
          open={openField === field}
          onOpenChange={(open) => setOpenField(open ? field : null)}
        />
      ))}

      {filters.extra.map((extra, i) => (
        <span key={`${extra}-${i}`} className={cn("inline-flex items-center rounded-full", "bg-accent-soft")}>
          <Tooltip content={extra}>
            <span className={cn(chip, chipActive, "max-w-[18rem] rounded-r-none border-r-0 pr-1.5")}>
              <span className="truncate">{describeExtra(extra)}</span>
            </span>
          </Tooltip>
          <button
            type="button"
            onClick={() => set({ extra: filters.extra.filter((_, j) => j !== i) })}
            aria-label={`Remove the condition ${describeExtra(extra)}`}
            className={cn(chip, chipActive, "rounded-l-none border-l-0 px-1.5 hover:bg-accent/15")}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      ))}

      {addable.length > 0 && (
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={cn(chip, chipIdle, "border-dashed")}>
              <Plus aria-hidden="true" />
              Filter
            </button>
          </MenuTrigger>
          <MenuContent>
            {addable.map((f) => (
              <MenuItem
                key={f}
                onSelect={() => {
                  setPinned((p) => [...p, f]);
                  // Open the new chip once it's on screen.
                  setTimeout(() => setOpenField(f), 0);
                }}
              >
                {LABELS[f]}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem icon={<Code2 aria-hidden="true" />} onSelect={onEditTQL}>
              Any field, with TQL…
            </MenuItem>
          </MenuContent>
        </Menu>
      )}

      <button type="button" onClick={onEditTQL} className={cn(chip, chipIdle, "gap-1")}>
        <Code2 aria-hidden="true" />
        Edit as TQL
      </button>

      {activeFilterCount(filters) > 0 && (
        <button
          type="button"
          onClick={() => {
            setPinned([]);
            onChange({ ...emptyFilters(filters.projectKey) });
          }}
          className="h-7 rounded-control px-2 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          Clear
        </button>
      )}
    </div>
  );
}
