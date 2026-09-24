"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, Layers, Plus, X } from "lucide-react";
import type { IssueType, PriorityLevel, User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import UserAvatar from "@/components/common/UserAvatar";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import { Menu, MenuCheckboxItem, MenuContent, MenuLabel, MenuTrigger } from "@/components/ui/Menu";
import { cn } from "@/components/ui/cn";
import { hasBoardFilters, type BoardFilterState } from "@/lib/board";

export type SwimlaneGroupBy = "NONE" | "ASSIGNEE" | "EPIC" | "PRIORITY";

const TYPES: { value: IssueType; label: string }[] = [
  { value: "STORY", label: "Story" },
  { value: "TASK", label: "Task" },
  { value: "BUG", label: "Bug" },
  { value: "SUBTASK", label: "Subtask" },
];
const PRIORITIES: { value: PriorityLevel; label: string }[] = [
  { value: "HIGHEST", label: "Highest" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "LOWEST", label: "Lowest" },
];
const GROUPS: { value: SwimlaneGroupBy; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "ASSIGNEE", label: "Assignee" },
  { value: "EPIC", label: "Epic" },
  { value: "PRIORITY", label: "Priority" },
];

const chip =
  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5";
const chipIdle = "border-subtle bg-surface text-ink-2 hover:border-strong hover:text-ink";
const chipActive = "border-accent/40 bg-accent-soft text-accent";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** A chip that opens a multi-select menu, with its own remove button when active. */
function FilterChip({
  label,
  summary,
  active,
  onClear,
  children,
}: {
  label: string;
  summary?: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full", active && "bg-accent-soft")}>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className={cn(chip, active ? cn(chipActive, "rounded-r-none border-r-0 pr-1.5") : chipIdle)}>
            {active ? `${label}: ${summary}` : label}
            <ChevronDown aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent className="max-h-80 overflow-y-auto">{children}</MenuContent>
      </Menu>
      {active && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove the ${label.toLowerCase()} filter`}
          className={cn(chip, chipActive, "rounded-l-none border-l-0 px-1.5 hover:bg-accent/15")}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

const summarize = (names: string[]) => (names.length === 1 ? names[0] : `${names.length}`);

interface BoardFiltersProps {
  users: User[];
  filters: BoardFilterState;
  onChange: (next: BoardFilterState) => void;
  groupBy: SwimlaneGroupBy;
  onSelectGroupBy: (groupBy: SwimlaneGroupBy) => void;
  /** The Issues page with these filters as TQL, for filtering on any other field. */
  moreFiltersHref: string;
}

/**
 * The board's filters as chips: people, type and priority, each removable
 * when set, plus "Filter" to carry on in the Issues page with TQL.
 */
export default function BoardFilters({ users, filters, onChange, groupBy, onSelectGroupBy, moreFiltersHref }: BoardFiltersProps) {
  const { currentUser } = useCurrentUser();
  const set = (patch: Partial<BoardFilterState>) => onChange({ ...filters, ...patch });
  const keepOpen = (e: Event) => e.preventDefault();
  const people = users.filter((u) => filters.assigneeIds.includes(u.id)).map((u) => u.name.split(/\s+/)[0]);

  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2 py-2.5">
      {currentUser && (
        <button
          type="button"
          aria-pressed={filters.onlyMine}
          onClick={() => set({ onlyMine: !filters.onlyMine })}
          className={cn(chip, filters.onlyMine ? chipActive : chipIdle)}
        >
          Only mine
        </button>
      )}

      {users.length > 0 && (
        <FilterChip
          label="People"
          summary={summarize(people)}
          active={filters.assigneeIds.length > 0}
          onClear={() => set({ assigneeIds: [] })}
        >
          <MenuLabel>Assignee</MenuLabel>
          {users.map((u) => (
            <MenuCheckboxItem
              key={u.id}
              checked={filters.assigneeIds.includes(u.id)}
              onCheckedChange={() => set({ assigneeIds: toggle(filters.assigneeIds, u.id) })}
              onSelect={keepOpen}
            >
              <span className="flex items-center gap-2">
                <UserAvatar user={u} size="xs" />
                {u.name}
              </span>
            </MenuCheckboxItem>
          ))}
        </FilterChip>
      )}

      <FilterChip
        label="Type"
        summary={summarize(TYPES.filter((t) => filters.types.includes(t.value)).map((t) => t.label))}
        active={filters.types.length > 0}
        onClear={() => set({ types: [] })}
      >
        {TYPES.map((t) => (
          <MenuCheckboxItem
            key={t.value}
            checked={filters.types.includes(t.value)}
            onCheckedChange={() => set({ types: toggle(filters.types, t.value) })}
            onSelect={keepOpen}
          >
            <span className="flex items-center gap-2">
              <IssueTypeIcon type={t.value} className="h-4 w-4" />
              {t.label}
            </span>
          </MenuCheckboxItem>
        ))}
      </FilterChip>

      <FilterChip
        label="Priority"
        summary={summarize(PRIORITIES.filter((p) => filters.priorities.includes(p.value)).map((p) => p.label))}
        active={filters.priorities.length > 0}
        onClear={() => set({ priorities: [] })}
      >
        {PRIORITIES.map((p) => (
          <MenuCheckboxItem
            key={p.value}
            checked={filters.priorities.includes(p.value)}
            onCheckedChange={() => set({ priorities: toggle(filters.priorities, p.value) })}
            onSelect={keepOpen}
          >
            <span className="flex items-center gap-2">
              <PriorityIcon priority={p.value} className="h-4 w-4" />
              {p.label}
            </span>
          </MenuCheckboxItem>
        ))}
      </FilterChip>

      <Link
        prefetch={false}
        href={moreFiltersHref}
        title="Filter by any field on the Issues page, with TQL"
        className={cn(chip, chipIdle, "border-dashed")}
      >
        <Plus aria-hidden="true" />
        Filter
        <span className="sr-only"> by any field on the Issues page</span>
      </Link>

      {hasBoardFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange({ assigneeIds: [], types: [], priorities: [], onlyMine: false })}
          className="h-7 rounded-control px-2 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          Clear
        </button>
      )}

      <span className="ml-auto">
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={cn(chip, groupBy === "NONE" ? chipIdle : chipActive)}>
              <Layers aria-hidden="true" />
              Group{groupBy === "NONE" ? "" : `: ${GROUPS.find((g) => g.value === groupBy)?.label}`}
              <ChevronDown aria-hidden="true" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Group rows by</MenuLabel>
            {GROUPS.map((g) => (
              <MenuCheckboxItem key={g.value} checked={groupBy === g.value} onCheckedChange={() => onSelectGroupBy(g.value)}>
                {g.label}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </Menu>
      </span>
    </div>
  );
}
