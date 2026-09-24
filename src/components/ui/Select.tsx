"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "./cn";
import { useFieldControl } from "./Field";
import { floatingClassName } from "./Popover";
import { filterOptions, nextActiveIndex, typeaheadIndex } from "./listNavigation";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  /** Extra words the search should match. */
  keywords?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Adds a search box above the list: use for people, epics, versions. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-keyshortcuts"?: string;
  required?: boolean;
  className?: string;
  /** "property" is borderless until hovered, for values in a list of properties. */
  variant?: "field" | "property";
  /** Control whether the list is open, e.g. to open it from a keyboard shortcut. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A single-choice picker. The trigger is a combobox button, the options a listbox;
 * arrow keys, Home/End and Enter work, typing jumps to an option (or filters,
 * when searchable) and Escape closes it with focus back on the trigger.
 * Replaces native selects that can't show icons or descriptions.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  disabled,
  className,
  variant = "field",
  open: openProp,
  onOpenChange,
  ...rest
}: SelectProps) {
  // The trigger is a select-only combobox (as in Radix Select), a role that,
  // unlike a plain button, can be marked required.
  const { required, ...fieldProps } = useFieldControl(rest);
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const listboxId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const visible = useMemo(() => (searchable ? filterOptions(options, query) : options), [options, query, searchable]);
  const selected = options.find((o) => o.value === value) ?? null;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  // Opening starts on the selected option; filtering starts on the first match.
  useEffect(() => {
    if (!open) return;
    const selectedIndex = visible.findIndex((o) => o.value === value && !o.disabled);
    setActive(selectedIndex >= 0 && !query ? selectedIndex : nextActiveIndex(visible, -1, "ArrowDown") ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the list itself changes
  }, [open, query]);

  useEffect(() => {
    if (open && active >= 0) {
      document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable per render
  }, [active, open]);

  function choose(index: number) {
    const option = visible[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const moved = nextActiveIndex(visible, active, e.key);
    if (moved !== null) {
      e.preventDefault();
      setActive(moved);
      return;
    }
    if (e.key === "Enter" || (!searchable && e.key === " ")) {
      e.preventDefault();
      if (active >= 0) choose(active);
      return;
    }
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const text = now - typed.current.at < 600 ? typed.current.text + e.key : e.key;
      typed.current = { text, at: now };
      setActive(typeaheadIndex(visible, active, text));
    }
  }

  const activeDescendant = active >= 0 && visible[active] ? optionId(active) : undefined;

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <RadixPopover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-required={required || undefined}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          className={cn(
            "group inline-flex h-8 w-full items-center gap-2 rounded-control border px-2.5 text-left text-[13px] text-ink transition-colors duration-150",
            variant === "field"
              ? "border-subtle bg-surface hover:border-strong disabled:bg-surface-sunk disabled:opacity-60 aria-[invalid=true]:border-danger data-[state=open]:border-accent"
              : "border-transparent bg-transparent px-2 hover:bg-surface-sunk disabled:hover:bg-transparent data-[state=open]:bg-surface-sunk",
            "disabled:cursor-not-allowed",
            className
          )}
          {...fieldProps}
        >
          {selected?.icon ? (
            <span aria-hidden="true" className="inline-flex shrink-0">
              {selected.icon}
            </span>
          ) : null}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>{selected ? selected.label : placeholder}</span>
          {variant === "field" || !disabled ? (
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted",
                variant === "property" && "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              )}
              aria-hidden="true"
            />
          ) : null}
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => {
            // Focus the search box, or the list itself, rather than the first option.
            e.preventDefault();
            (searchable ? (e.currentTarget as HTMLElement).querySelector("input") : listRef.current)?.focus();
          }}
          className={cn(floatingClassName, "flex w-[var(--radix-popover-trigger-width)] min-w-48 flex-col p-1")}
        >
          {searchable ? (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeDescendant}
                aria-label={searchPlaceholder.replace(/…$/, "")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-[4px] border border-subtle bg-surface-sunk pl-7 pr-2 text-[13px] text-ink placeholder:text-muted focus:border-accent"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={rest["aria-label"] ?? (typeof placeholder === "string" ? placeholder : undefined)}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={searchable ? undefined : activeDescendant}
            onKeyDown={searchable ? undefined : onKeyDown}
            className="max-h-64 overflow-y-auto outline-none"
          >
            {visible.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                onMouseMove={() => !option.disabled && active !== index && setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                className={cn(
                  "flex min-h-8 cursor-default select-none items-center gap-2 rounded-[4px] px-2 py-1 text-[13px] text-ink",
                  index === active && "bg-surface-sunk",
                  option.disabled && "opacity-50"
                )}
              >
                {option.icon ? (
                  <span aria-hidden="true" className="inline-flex shrink-0">
                    {option.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? <span className="block truncate text-xs text-muted">{option.description}</span> : null}
                </span>
                {option.value === value ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
              </li>
            ))}
            {visible.length === 0 ? (
              <li role="presentation" className="px-2 py-2 text-[13px] text-muted">
                {emptyMessage}
              </li>
            ) : null}
          </ul>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/** A Select with a search box, for long lists such as people and epics. */
export function Combobox(props: Omit<SelectProps, "searchable">) {
  return <Select {...props} searchable />;
}
