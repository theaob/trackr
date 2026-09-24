"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, ListFilter, Plus, Search, X } from "lucide-react";
import type { Project } from "@/types";
import { useSearch } from "@/context/SearchContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { filterablePage } from "@/lib/spotlight";
import { shellLocation } from "@/lib/shell";
import { FILTER_PAGE_EVENT } from "@/components/common/SpotlightSearch";
import NotificationsMenu from "@/components/layout/NotificationsMenu";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/Popover";

export interface TopBarProps {
  currentProject?: Project | null;
  onCreateIssue?: () => void;
  /** Kept for callers; on phones the tab bar's More opens the rail now. */
  onOpenRail?: () => void;
}

/** Where you are, and what you can do here. Everything else lives in the rail. */
export default function TopBar({ currentProject, onCreateIssue }: TopBarProps) {
  const pathname = usePathname();
  const location = shellLocation(pathname);
  // Home and Inbox take their heading from here; every other page has its own h1.
  const CurrentPage = location.section === "home" || location.section === "inbox" ? "h1" : "span";
  const { searchQuery, setSearchQuery } = useSearch();
  const { openShortcutsModal, openSpotlight } = useKeyboardShortcutsContext();
  const canFilterPage = filterablePage(pathname) !== null;
  const [phoneFilterOpen, setPhoneFilterOpen] = useState(false);

  // "Filter … for" in ⌘K search fills in the filter box.
  useEffect(() => {
    const applyFilter = (event: Event) => {
      setSearchQuery((event as CustomEvent<{ query?: string }>).detail?.query ?? "");
      if (window.matchMedia("(max-width: 767px)").matches) setPhoneFilterOpen(true);
    };
    window.addEventListener(FILTER_PAGE_EVENT, applyFilter);
    return () => window.removeEventListener(FILTER_PAGE_EVENT, applyFilter);
  }, [setSearchQuery]);

  const project = location.section === "project" ? currentProject : null;

  const filterInput = (id: string | undefined, autoFocus = false) => (
    <div className="relative w-full">
      <ListFilter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        id={id}
        type="text"
        aria-label="Filter issues on this page"
        placeholder="Filter issues…"
        autoFocus={autoFocus}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 w-full rounded-control border border-subtle bg-surface pl-8 pr-8 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
      />
      {searchQuery ? (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          aria-label="Clear filter"
          className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">/</kbd>
      )}
    </div>
  );

  return (
    <header className="relative z-30 shrink-0 border-b border-subtle bg-surface">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {project && (
              <>
                <li className="hidden min-w-0 sm:block">
                  <Link
                    prefetch={false}
                    href={`/projects/${project.key}/board`}
                    className="block truncate text-ink-2 hover:text-ink hover:underline"
                  >
                    {project.name}
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden text-muted sm:block">
                  /
                </li>
                {location.issueKey && (
                  <>
                    <li className="hidden sm:block">
                      <Link prefetch={false} href={`/projects/${project.key}/issues`} className="text-ink-2 hover:text-ink hover:underline">
                        Issues
                      </Link>
                    </li>
                    <li aria-hidden="true" className="hidden text-muted sm:block">
                      /
                    </li>
                  </>
                )}
              </>
            )}
            <li className="min-w-0">
              <CurrentPage aria-current="page" className="block truncate text-[13px] font-semibold text-ink">
                {location.title}
              </CurrentPage>
            </li>
          </ol>
        </nav>

        {canFilterPage && <div className="hidden w-56 md:block">{filterInput("global-search-input")}</div>}
        {canFilterPage && (
          <IconButton
            label={phoneFilterOpen ? "Hide filter" : "Filter issues"}
            icon={<ListFilter />}
            onClick={() => setPhoneFilterOpen((open) => !open)}
            aria-expanded={phoneFilterOpen}
            className={cn("md:hidden", searchQuery && "text-accent")}
          />
        )}
        <IconButton label="Search" icon={<Search />} onClick={openSpotlight} className="md:hidden" />

        {onCreateIssue && (
          <Tooltip content="New issue (C)">
            <Button variant="primary" size="sm" onClick={onCreateIssue} aria-keyshortcuts="C">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New issue</span>
              <span className="sr-only sm:hidden">New issue</span>
              <kbd aria-hidden="true" className="hidden rounded bg-accent-fg/20 px-1 font-mono text-[10px] sm:inline">
                C
              </kbd>
            </Button>
          </Tooltip>
        )}
        <IconButton label="Keyboard shortcuts" icon={<HelpCircle />} onClick={openShortcutsModal} className="hidden sm:inline-flex" />
        <NotificationsMenu />
      </div>
      {canFilterPage && phoneFilterOpen && <div className="border-t border-subtle px-3 py-2 md:hidden">{filterInput(undefined, true)}</div>}
    </header>
  );
}
