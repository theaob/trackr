"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Check,
  AlertCircle,
  Code2,
  HelpCircle,
  X,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import { TQLParser } from "@/lib/tql/parser";
import { getTQLCompletions, TQLSuggestion, TQLAutocompleteContext } from "@/lib/tql/autocomplete";

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

  return (
    <div className="relative flex flex-col gap-1.5 w-full">
      {/* Top bar with input & actions */}
      <div className="flex items-center gap-2">
        {/* Main Query Bar */}
        <div className="relative flex-1 flex items-center">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-jira-gray-500 pointer-events-none">
            <Code2 className="w-4 h-4 text-jira-blue" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. project = "APOLLO" AND status = "In Progress" AND assignee = currentUser() ORDER BY priority DESC'
            className={`w-full pl-9 pr-24 py-1.5 text-xs font-mono bg-white border rounded shadow-2xs outline-none transition-all ${
              !query.trim()
                ? "border-jira-gray-300 focus:border-jira-blue"
                : parseResult.success
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                : "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200"
            }`}
          />

          {/* Inline Actions & Syntax Indicator */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query.trim() && (
              <>
                {parseResult.success ? (
                  <span
                    title="Valid query syntax"
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-default"
                  >
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="hidden sm:inline">Valid JQL</span>
                  </span>
                ) : (
                  <span
                    title={parseResult.error.message}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 cursor-help"
                  >
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="hidden sm:inline">Syntax Error</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-jira-gray-400 hover:text-jira-gray-700 rounded transition-colors"
                  title="Clear query"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-1 text-jira-gray-400 hover:text-jira-blue rounded transition-colors"
              title="JQL Syntax Guide (?)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Execute Button */}
        <button
          type="button"
          onClick={onSearch}
          disabled={isLoading || (!parseResult.success && !!query.trim())}
          className="px-3.5 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>

        {/* Switch to Basic Mode */}
        {onSwitchToBasic && (
          <button
            type="button"
            onClick={onSwitchToBasic}
            className="px-2.5 py-1.5 bg-jira-gray-100 hover:bg-jira-gray-200 text-jira-gray-700 text-xs font-medium rounded flex items-center gap-1 transition-colors shrink-0"
            title="Switch to visual filter dropdowns"
          >
            <Filter className="w-3.5 h-3.5 text-jira-gray-600" />
            <span>Basic</span>
          </button>
        )}
      </div>

      {/* Syntax Error Banner */}
      {!parseResult.success && query.trim() && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span>
            <strong>Syntax Error:</strong> {parseResult.error.message}
          </span>
        </div>
      )}

      {/* Autocomplete Suggestions Popover */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1 w-96 max-h-64 overflow-y-auto bg-white border border-jira-gray-300 rounded-md shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1"
        >
          <div className="px-3 py-1 text-[10px] font-bold text-jira-gray-500 uppercase tracking-wider border-b border-jira-gray-100 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-jira-blue" /> Suggestions
            </span>
            <span className="text-jira-gray-400 font-mono text-[9px]">Tab / Enter to select</span>
          </div>

          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                onClick={() => handleApplySuggestion(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  isSelected ? "bg-jira-blue-light/70 text-jira-blue" : "hover:bg-jira-gray-100 text-jira-navy"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      item.type === "field"
                        ? "bg-blue-100 text-blue-700"
                        : item.type === "operator"
                        ? "bg-amber-100 text-amber-800"
                        : item.type === "function"
                        ? "bg-purple-100 text-purple-800 font-mono"
                        : item.type === "value"
                        ? "bg-emerald-100 text-emerald-800 font-mono"
                        : "bg-jira-gray-200 text-jira-gray-700"
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="font-semibold font-mono">{item.label}</span>
                </div>
                <span className="text-[11px] text-jira-gray-500 truncate max-w-[160px]">{item.detail}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* JQL Syntax Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-0 sm:p-4">
          <div className="bg-white border border-jira-gray-300 sm:rounded-lg shadow-2xl max-w-2xl w-full min-h-full sm:min-h-0 sm:max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 border-b border-jira-gray-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Code2 className="w-5 h-5 text-jira-blue shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-jira-navy truncate">Trackr JQL Query Syntax Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-jira-gray-400 hover:text-jira-gray-700 rounded transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 space-y-4 text-xs text-jira-gray-700">
              <div>
                <h4 className="font-bold text-jira-navy mb-1.5">Common Query Examples</h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[
                    {
                      q: 'project = "APOLLO" AND status = "In Progress"',
                      desc: "All issues in Apollo currently in progress",
                    },
                    {
                      q: "type in (Bug, Story) AND priority in (High, Highest)",
                      desc: "High priority bugs and stories",
                    },
                    {
                      q: "assignee = currentUser() AND statusCategory != Done",
                      desc: "My open unresolved issues across all projects",
                    },
                    {
                      q: "assignee is EMPTY AND sprint in openSprints()",
                      desc: "Unassigned work in active sprints",
                    },
                    {
                      q: "created >= -7d ORDER BY created DESC",
                      desc: "Issues created within the last 7 days, newest first",
                    },
                    {
                      q: 'summary ~ "memory leak" OR description ~ "crash"',
                      desc: "Keyword search across issue titles and descriptions",
                    },
                  ].map((example, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        onChange(example.q);
                        setShowHelpModal(false);
                      }}
                      className="p-2 bg-jira-gray-50 hover:bg-jira-blue-light/50 border border-jira-gray-200 rounded cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2 text-jira-blue font-semibold">
                        <span className="break-all">{example.q}</span>
                        <span className="text-[10px] text-jira-gray-400 group-hover:text-jira-blue flex items-center gap-0.5 shrink-0 pt-0.5">
                          Use <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <p className="text-[10px] text-jira-gray-600 font-sans mt-0.5">{example.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-jira-gray-200">
                <div>
                  <h4 className="font-bold text-jira-navy mb-1">Supported Fields</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-jira-gray-600">
                    <li><code className="font-mono">project</code> (key or name)</li>
                    <li><code className="font-mono">type</code> (Bug, Story, Task, Epic)</li>
                    <li><code className="font-mono">status</code>, <code className="font-mono">statusCategory</code></li>
                    <li><code className="font-mono">priority</code> (Highest, High, Medium, Low, Lowest)</li>
                    <li><code className="font-mono">assignee</code>, <code className="font-mono">reporter</code></li>
                    <li><code className="font-mono">sprint</code>, <code className="font-mono">fixVersion</code></li>
                    <li><code className="font-mono">labels</code>, <code className="font-mono">component</code></li>
                    <li><code className="font-mono">created</code>, <code className="font-mono">updated</code>, <code className="font-mono">dueDate</code></li>
                    <li><code className="font-mono">storyPoints</code>, <code className="font-mono">summary</code>, <code className="font-mono">text</code></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-jira-navy mb-1">Dynamic Functions</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-jira-gray-600">
                    <li><code className="font-mono">currentUser()</code></li>
                    <li><code className="font-mono">openSprints()</code></li>
                    <li><code className="font-mono">unreleasedVersions()</code></li>
                    <li><code className="font-mono">now()</code>, <code className="font-mono">startOfDay()</code>, <code className="font-mono">endOfDay()</code></li>
                    <li>Relative dates: <code className="font-mono">-7d</code>, <code className="font-mono">-24h</code>, <code className="font-mono">-2w</code>, <code className="font-mono">+3d</code></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 sm:px-6 border-t border-jira-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
