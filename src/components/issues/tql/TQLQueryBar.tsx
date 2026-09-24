"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, Check, AlertCircle, Code2, HelpCircle, X, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/components/ui/cn";
import { TQLParser } from "@/lib/tql/parser";
import { getTQLCompletions, TQLSuggestion, TQLAutocompleteContext } from "@/lib/tql/autocomplete";
import { Tooltip } from "@/components/ui/Popover";

export interface TQLQueryBarProps {
  query: string;
  onChange: (query: string) => void;
  onSearch: () => void;
  onSwitchToBasic?: () => void;
  isLoading?: boolean;
  context?: TQLAutocompleteContext;
}

export default function TQLQueryBar({
  query,
  onChange,
  onSearch,
  onSwitchToBasic,
  isLoading = false,
  context = {},
}: TQLQueryBarProps) {
  const [cursorPos, setCursorPos] = useState<number>(query.length);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Validate syntax in real-time
  const parseResult = useMemo(() => {
    return TQLParser.parse(query);
  }, [query]);

  // Compute completions
  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    return getTQLCompletions(query, cursorPos, context);
  }, [query, cursorPos, showSuggestions, context]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApplySuggestion = (suggestion: TQLSuggestion) => {
    // Find where the current word started
    const textBefore = query.slice(0, cursorPos);
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_\-\[\]"]+)$/);
    const replaceStart = lastWordMatch ? cursorPos - lastWordMatch[1].length : cursorPos;
    const textAfter = query.slice(cursorPos);

    const newQuery = query.slice(0, replaceStart) + suggestion.insertText + textAfter;
    const newCursor = replaceStart + suggestion.insertText.length;

    onChange(newQuery);
    setShowSuggestions(false);

    // Refocus input and restore cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursor, newCursor);
        setCursorPos(newCursor);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleApplySuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);
    setShowSuggestions(true);
  };

  const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setCursorPos(target.selectionStart || 0);
  };

  const listboxId = "tql-suggestions";
  const open = showSuggestions && suggestions.length > 0;
  const EXAMPLES = [
    { q: 'project = "APOLLO" AND status = "IN_PROGRESS"', desc: "Everything in Apollo that's in progress" },
    { q: "type in (Bug, Story) AND priority in (High, Highest)", desc: "High-priority bugs and stories" },
    { q: "assignee = currentUser() AND statusCategory != Done", desc: "My open issues, across projects" },
    { q: "assignee is EMPTY AND sprint in openSprints()", desc: "Unassigned work in active sprints" },
    { q: "created >= -7d ORDER BY created DESC", desc: "Created in the last 7 days, newest first" },
    { q: 'summary ~ "memory leak" OR description ~ "crash"', desc: "A phrase in titles or descriptions" },
  ];

  return (
    <div className="relative flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex flex-1 items-center">
          <Code2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="TQL query"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={open ? `${listboxId}-${selectedIndex}` : undefined}
            aria-invalid={!!query.trim() && !parseResult.success}
            spellCheck={false}
            value={query}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. status = "IN_PROGRESS" AND assignee = currentUser() ORDER BY updated DESC'
            className={cn(
              "h-8 w-full rounded-control border bg-surface pl-8 pr-40 font-mono text-xs text-ink placeholder:text-muted",
              !query.trim() ? "border-subtle focus:border-accent" : parseResult.success ? "border-success focus:border-success" : "border-danger"
            )}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {query.trim() &&
              (parseResult.success ? (
                <span className="hidden items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium leading-5 text-success sm:inline-flex">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Valid TQL
                </span>
              ) : (
                <span className="hidden items-center gap-1 rounded-full bg-danger-soft px-2 text-[11px] font-medium leading-5 text-danger sm:inline-flex">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Error
                </span>
              ))}
            {query.trim() && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                aria-label="Clear the query"
                className="inline-flex h-6 w-6 items-center justify-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              aria-label="TQL syntax guide"
              className="inline-flex h-6 w-6 items-center justify-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={onSearch} disabled={isLoading || (!parseResult.success && !!query.trim())}>
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Search
        </Button>
        {onSwitchToBasic && (
          <Tooltip content="Show this query as filter chips">
            <Button size="sm" onClick={onSwitchToBasic}>
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filters
            </Button>
          </Tooltip>
        )}
      </div>

      {!parseResult.success && query.trim() && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {parseResult.error.message}
        </p>
      )}

      {open && (
        <div ref={popoverRef} className="absolute left-0 top-full z-50 mt-1 w-[26rem] max-w-full rounded-card border border-subtle bg-surface py-1 shadow-overlay">
          <p className="flex items-center justify-between border-b border-subtle px-3 pb-1 text-[11px] text-ink-2">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Suggestions
            </span>
            <span>Tab or Enter to use</span>
          </p>
          <ul id={listboxId} role="listbox" aria-label="Suggestions" className="max-h-64 overflow-y-auto">
            {suggestions.map((item, index) => (
              <li
                key={`${item.label}-${index}`}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleApplySuggestion(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex min-h-8 cursor-default items-center justify-between gap-2 px-3 text-xs",
                  index === selectedIndex ? "bg-surface-sunk" : undefined
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] text-ink-2">{item.type}</span>
                  <span className="font-mono text-ink">{item.label}</span>
                </span>
                <span className="max-w-[12rem] truncate text-[11px] text-ink-2">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent
          size="lg"
          title="TQL, Trackr's query language"
          description="Pick an example to start from, or combine fields with AND, OR and NOT."
          footer={<Button onClick={() => setShowHelpModal(false)}>Done</Button>}
        >
          <ul className="flex flex-col gap-1.5">
            {EXAMPLES.map((example) => (
              <li key={example.q}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(example.q);
                    setShowHelpModal(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 rounded-control border border-subtle px-3 py-2 text-left hover:border-strong hover:bg-surface-sunk"
                >
                  <code className="break-all font-mono text-xs text-ink">{example.q}</code>
                  <span className="text-xs text-ink-2">{example.desc}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-subtle pt-3 text-xs text-ink-2 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-ink">Fields</h3>
              <p className="font-mono leading-5">
                project, type, status, statusCategory, priority, assignee, reporter, sprint, fixVersion, labels, component, created, updated,
                dueDate, storyPoints, summary, text
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-ink">Functions and dates</h3>
              <p className="font-mono leading-5">currentUser(), openSprints(), unreleasedVersions(), now(), startOfDay(), endOfDay()</p>
              <p className="mt-1">
                Relative dates: <code className="font-mono">-7d</code>, <code className="font-mono">-24h</code>, <code className="font-mono">-2w</code>,{" "}
                <code className="font-mono">+3d</code>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
