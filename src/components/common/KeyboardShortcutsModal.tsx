"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Command } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Global" | "Navigation" | "Forms & Dialogs";
}

const SHORTCUTS: ShortcutItem[] = [
  // Global
  { keys: ["c"], description: "Create an issue", category: "Global" },
  { keys: ["⌘ / Ctrl", "K"], description: "Search issues, pages and projects", category: "Global" },
  { keys: ["/"], description: "Filter the board, backlog or issue list (search elsewhere)", category: "Global" },
  { keys: ["?"], description: "Open keyboard shortcuts cheat sheet", category: "Global" },
  { keys: ["["], description: "Collapse or expand the sidebar", category: "Global" },
  { keys: ["Esc"], description: "Close active modal, dropdown, or blur search", category: "Global" },

  // Navigation
  { keys: ["g", "d"], description: "Go to Board", category: "Navigation" },
  { keys: ["g", "b"], description: "Go to Backlog", category: "Navigation" },
  { keys: ["g", "i"], description: "Go to Issues navigator", category: "Navigation" },
  { keys: ["g", "r"], description: "Go to Roadmap", category: "Navigation" },
  { keys: ["g", "l"], description: "Go to Releases", category: "Navigation" },
  { keys: ["g", "e"], description: "Go to Reports", category: "Navigation" },
  { keys: ["g", "s"], description: "Go to Project Settings", category: "Navigation" },
  { keys: ["g", "p"], description: "Go to All Projects", category: "Navigation" },
  { keys: ["g", "h"], description: "Go to Home (new layout)", category: "Navigation" },
  { keys: ["g", "n"], description: "Go to Inbox (new layout)", category: "Navigation" },

  // Forms & Dialogs
  { keys: ["←", "→"], description: "Navigate to previous / next issue", category: "Forms & Dialogs" },
  { keys: ["⌘ / Ctrl", "↵"], description: "Submit form or modal", category: "Forms & Dialogs" },
  { keys: ["Esc"], description: "Cancel or close dialog", category: "Forms & Dialogs" },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUTS;
    const q = searchQuery.toLowerCase();
    return SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutItem[]>();
    filteredShortcuts.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [filteredShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-jira-gray-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-jira-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-jira-blue" />
            <h2 id="shortcuts-dialog-title" className="text-base font-bold text-jira-navy">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-100 rounded-md transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-jira-gray-50 border border-jira-gray-300 focus:border-jira-blue focus:bg-white rounded-md transition-all text-jira-navy placeholder-jira-gray-400"
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-5 divide-y divide-jira-gray-100">
          {grouped.size === 0 ? (
            <div className="py-8 text-center text-xs text-jira-gray-500">
              No shortcuts found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items], catIdx) => (
              <div key={category} className={catIdx > 0 ? "pt-4" : ""}>
                <h3 className="text-[11px] font-bold text-jira-gray-600 uppercase tracking-wider mb-2.5">
                  {category}
                  {category === "Navigation" && (
                    <span className="text-[10px] font-normal text-jira-gray-500 ml-1.5">
                      (press keys in sequence)
                    </span>
                  )}
                </h3>
                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-jira-gray-50 transition-colors text-xs"
                    >
                      <span className="text-jira-gray-800 font-medium">{item.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            {kIdx > 0 && item.category === "Navigation" && (
                              <span className="text-[10px] text-jira-gray-400 font-mono">then</span>
                            )}
                            {kIdx > 0 && item.category !== "Navigation" && (
                              <span className="text-[10px] text-jira-gray-400 font-mono">+</span>
                            )}
                            <kbd className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 text-[11px] font-semibold text-jira-navy bg-jira-gray-100 border border-jira-gray-300 rounded shadow-2xs font-mono">
                              {k}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-jira-gray-200 bg-jira-gray-50 flex items-center justify-between text-[11px] text-jira-gray-500">
          <span>Shortcuts work whenever you are not typing in a text field.</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-jira-gray-300 rounded shadow-2xs">
            Esc to close
          </kbd>
        </div>
      </div>
    </div>
  );
}
