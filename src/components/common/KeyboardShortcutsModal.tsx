"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Global" | "Navigation" | "Issue" | "Forms & Dialogs";
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
  { keys: ["g", "h"], description: "Go to Home", category: "Navigation" },
  { keys: ["g", "n"], description: "Go to Inbox", category: "Navigation" },

  // An open issue
  { keys: ["a"], description: "Change the assignee", category: "Issue" },
  { keys: ["s"], description: "Change the status", category: "Issue" },
  { keys: ["p"], description: "Change the priority", category: "Issue" },
  { keys: ["i"], description: "Assign the issue to me", category: "Issue" },
  { keys: ["←", "→"], description: "Previous / next issue in the list", category: "Issue" },

  // Forms & Dialogs
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
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Keyboard shortcuts"
        description="Shortcuts work whenever you aren't typing in a text field."
        size="lg"
        className="h-[min(40rem,calc(100dvh-2rem))]"
      >
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              autoFocus
              aria-label="Search shortcuts"
              placeholder="Search shortcuts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-control border border-subtle bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
            />
          </div>
        </div>
        {/* Shortcuts List */}
        <div className="space-y-5 divide-y divide-subtle">
          {grouped.size === 0 ? (
            <p role="status" className="py-8 text-center text-xs text-muted">
              No shortcuts match &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            Array.from(grouped.entries()).map(([category, items], catIdx) => (
              <div key={category} className={catIdx > 0 ? "pt-4" : ""}>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {category}
                  {category === "Navigation" && (
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      (press keys in sequence)
                    </span>
                  )}
                </h3>
                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-page transition-colors text-xs"
                    >
                      <span className="text-ink font-medium">{item.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            {kIdx > 0 && item.category === "Navigation" && (
                              <span className="text-[10px] text-muted font-mono">then</span>
                            )}
                            {kIdx > 0 && item.category !== "Navigation" && (
                              <span className="text-[10px] text-muted font-mono">+</span>
                            )}
                            <kbd className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 text-[11px] font-semibold text-ink bg-surface-sunk border border-subtle rounded shadow-2xs font-mono">
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
      </DialogContent>
    </Dialog>
  );
}
