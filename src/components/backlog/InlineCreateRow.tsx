"use client";

import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { IssueType } from "@/types";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import { Select } from "@/components/ui/Select";

const TYPES: { value: IssueType; label: string }[] = [
  { value: "STORY", label: "Story" },
  { value: "TASK", label: "Task" },
  { value: "BUG", label: "Bug" },
];

/**
 * "Create issue" at the foot of a section: a row where you type a title and
 * press Enter, after which it's empty and ready for the next one. Escape, or
 * leaving it empty, closes it.
 */
export default function InlineCreateRow({
  label,
  onCreate,
}: {
  /** Names the section, for the input's label: "Create an issue in Sprint 4". */
  label: string;
  onCreate: (title: string, type: IssueType) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>("STORY");
  const inputRef = useRef<HTMLInputElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setTitle("");
    requestAnimationFrame(() => openButton.current?.focus());
  };

  const submit = async () => {
    const text = title.trim();
    if (!text) return;
    setTitle("");
    const ok = await onCreate(text, type);
    if (!ok) setTitle(text);
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        ref={openButton}
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-sunk hover:text-ink"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create issue
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 bg-surface px-2 py-1.5"
      onBlur={(e) => {
        // Leaving the row with nothing typed closes it.
        if (!title.trim() && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          const next = e.relatedTarget as HTMLElement | null;
          if (!next?.closest("[data-radix-popper-content-wrapper]")) close();
        }
      }}
    >
      <div className="w-32 shrink-0">
        <Select
          aria-label="Issue type"
          options={TYPES.map((t) => ({
            value: t.value,
            label: t.label,
            icon: <IssueTypeIcon type={t.value} className="h-4 w-4 shrink-0" />,
          }))}
          value={type}
          onChange={(v) => setType(v as IssueType)}
          className="h-8"
        />
      </div>
      <input
        ref={inputRef}
        autoFocus
        type="text"
        aria-label={label}
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-control border border-accent bg-surface px-2.5 text-[13px] text-ink placeholder:text-muted"
      />
      <span className="hidden shrink-0 text-xs text-ink-2 sm:inline">
        <kbd className="font-mono">↵</kbd> to add · <kbd className="font-mono">Esc</kbd> to close
      </span>
    </div>
  );
}
