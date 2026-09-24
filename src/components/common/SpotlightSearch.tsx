"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Filter,
  Kanban,
  Keyboard,
  LayoutGrid,
  ListFilter,
  ListTodo,
  Loader2,
  Map,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import { IssueTypeIcon, StatusBadge } from "@/components/common/IssueIcons";
import { getSpotlightProjects, searchSpotlightIssues } from "@/lib/actions/search";
import {
  PAGE_SHORTCUTS,
  SpotlightDestination,
  SpotlightIssue,
  SpotlightProject,
  buildSpotlightDestinations,
  filterablePage,
  issueKeyForQuery,
  matchesEveryWord,
  projectKeyFromPath,
  rankDestinations,
  spotlightIssueHref,
} from "@/lib/spotlight";
import type { IssueType } from "@/types";

interface SpotlightSearchProps {
  onClose: () => void;
  /** Present when the current page can create an issue. */
  onCreateIssue?: () => void;
  onShowShortcuts: () => void;
}

/** Sent to the navbar, which owns the board/backlog/issues filter box. */
export const FILTER_PAGE_EVENT = "trackr:filter-page";

const PAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  board: Kanban,
  backlog: ListTodo,
  roadmap: Map,
  issues: ListFilter,
  reports: BarChart3,
  releases: Rocket,
  settings: Settings,
  projects: LayoutGrid,
  "system-settings": Shield,
};

const FILTERABLE_NAMES = { board: "the board", backlog: "the backlog", issues: "the issue list" } as const;

interface Row {
  id: string;
  href?: string;
  run?: () => void;
  render: (active: boolean) => React.ReactNode;
}

interface Group {
  label: string;
  rows: Row[];
}

// Kept between openings so projects and pages show instantly; refreshed each time.
let cachedProjects: SpotlightProject[] = [];

function Keys({ keys, active }: { keys: string[]; active: boolean }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className={`min-w-[20px] h-5 px-1 inline-flex items-center justify-center rounded text-xs font-sans font-medium border ${
            active ? "border-white/40 text-white/90" : "border-jira-gray-300 text-jira-gray-600 bg-white/70"
          }`}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

function IconTile({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
        active ? "bg-white/20 text-white" : "bg-jira-gray-100 text-jira-gray-700"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The ⌘K search panel. Finds issues in every project the viewer can read,
 * any page of any project, and the projects themselves, and opens the chosen
 * one. Everything works from the keyboard.
 */
export default function SpotlightSearch({ onClose, onCreateIssue, onShowShortcuts }: SpotlightSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();
  const modKey = useModKeyLabel();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<SpotlightProject[]>(cachedProjects);
  const [issues, setIssues] = useState<SpotlightIssue[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const searchSeq = useRef(0);

  const currentProjectKey = projectKeyFromPath(pathname);
  const filterable = filterablePage(pathname);
  const q = query.trim();

  useEffect(() => {
    let cancelled = false;
    getSpotlightProjects().then((list) => {
      cachedProjects = list;
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus the field on open and give focus back to whatever had it on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    if (!q) {
      searchSeq.current++;
      setIssues([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchSpotlightIssues(q, currentProjectKey)
        .then((results) => {
          if (searchSeq.current === seq) setIssues(results);
        })
        .finally(() => {
          if (searchSeq.current === seq) setSearching(false);
        });
    }, 120);
    return () => clearTimeout(timer);
  }, [q, currentProjectKey]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const destinations = useMemo(
    () =>
      buildSpotlightDestinations({
        projects,
        currentProjectKey,
        signedIn: !!currentUser,
        instanceAdmin: !!currentUser?.isInstanceAdmin,
      }),
    [projects, currentProjectKey, currentUser]
  );

  const groups = useMemo<Group[]>(() => {
    const destinationRow = (d: SpotlightDestination): Row => {
      const Icon = d.kind === "project" ? null : PAGE_ICONS[d.pageId ?? ""] ?? LayoutGrid;
      const shortcut = d.pageId && (d.current || !d.projectKey) ? PAGE_SHORTCUTS[d.pageId] : undefined;
      return {
        id: d.id,
        href: d.href,
        render: (isActive) => (
          <>
            {Icon ? (
              <IconTile active={isActive}>
                <Icon className="w-4 h-4" />
              </IconTile>
            ) : (
              <span
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-jira-blue-light text-jira-blue"
                }`}
              >
                {d.projectKey?.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{d.title}</span>
              {d.subtitle && (
                <span className={isActive ? "text-white/75" : "text-jira-gray-500"}>
                  {" "}
                  — {d.subtitle}
                </span>
              )}
            </span>
            {shortcut && <Keys keys={shortcut} active={isActive} />}
          </>
        ),
      };
    };

    const issueRow = (issue: SpotlightIssue): Row => ({
      id: `issue:${issue.id}`,
      href: spotlightIssueHref(issue.projectKey, issue.key),
      render: (isActive) => (
        <>
          <span className="w-7 flex justify-center shrink-0">
            <IssueTypeIcon type={issue.type as IssueType} className="w-3.5 h-3.5" />
          </span>
          <span className={`font-mono text-xs shrink-0 ${isActive ? "text-white/85" : "text-jira-gray-600"}`}>
            {issue.key}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
          {issue.projectKey !== currentProjectKey && (
            <span className={`hidden sm:inline text-xs shrink-0 ${isActive ? "text-white/75" : "text-jira-gray-500"}`}>
              {issue.projectName}
            </span>
          )}
          {/* A white backing keeps the lozenge readable on the highlighted row. */}
          <span className={`hidden sm:inline-flex shrink-0 rounded ${isActive ? "bg-white" : ""}`}>
            <StatusBadge status={issue.status} color={issue.statusColor} className="max-w-[9rem]" />
          </span>
        </>
      ),
    });

    const actionRow = (id: string, label: React.ReactNode, icon: React.ReactNode, run: () => void, keys?: string[]): Row => ({
      id,
      run,
      render: (isActive) => (
        <>
          <IconTile active={isActive}>{icon}</IconTile>
          <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          {keys && <Keys keys={keys} active={isActive} />}
        </>
      ),
    });

    const actions: Row[] = [];
    if (q && filterable) {
      actions.push(
        actionRow(
          "action:filter",
          <>
            Filter {FILTERABLE_NAMES[filterable]} for <span className="font-semibold">“{q}”</span>
          </>,
          <Filter className="w-4 h-4" />,
          () => window.dispatchEvent(new CustomEvent(FILTER_PAGE_EVENT, { detail: { query: q } }))
        )
      );
    }
    const lower = q.toLowerCase();
    const offers = (...phrases: string[]) => !q || phrases.some((p) => p.startsWith(lower));
    if (onCreateIssue && offers("create issue", "new issue")) {
      actions.push(actionRow("action:create", "Create issue", <Plus className="w-4 h-4" />, onCreateIssue, ["C"]));
    }
    if (offers("keyboard shortcuts", "shortcuts", "help")) {
      actions.push(actionRow("action:shortcuts", "Keyboard shortcuts", <Keyboard className="w-4 h-4" />, onShowShortcuts, ["?"]));
    }

    const result: Group[] = [];
    if (!q) {
      const here = destinations.filter((d) => d.kind === "page" && d.current);
      const global = destinations.filter((d) => d.kind === "page" && !d.projectKey);
      const currentName = destinations.find((d) => d.kind === "project" && d.current)?.title;
      result.push({ label: currentName ?? "Go to", rows: [...here, ...global].map(destinationRow) });
      result.push({
        label: "Projects",
        rows: destinations.filter((d) => d.kind === "project").slice(0, 6).map(destinationRow),
      });
      result.push({ label: "Actions", rows: actions });
    } else {
      // Drop results from an earlier query while the new ones are loading.
      const exactKey = issueKeyForQuery(q, currentProjectKey);
      const shownIssues = issues.filter((i) => i.key === exactKey || matchesEveryWord(i, q));
      const ranked = rankDestinations(q, destinations);
      const issueGroup = { label: "Issues", rows: shownIssues.map(issueRow) };
      if (exactKey) result.push(issueGroup);
      result.push({ label: "Projects", rows: ranked.filter((d) => d.kind === "project").slice(0, 4).map(destinationRow) });
      result.push({ label: "Pages", rows: ranked.filter((d) => d.kind === "page").slice(0, 6).map(destinationRow) });
      if (!exactKey) result.push(issueGroup);
      result.push({ label: "Actions", rows: actions });
    }
    return result.filter((g) => g.rows.length > 0);
  }, [q, issues, destinations, currentProjectKey, filterable, onCreateIssue, onShowShortcuts]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const activeIndex = rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeId = activeIndex >= 0 ? `spotlight-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const choose = (row: Row, newTab: boolean) => {
    if (row.href) {
      if (newTab) {
        window.open(row.href, "_blank", "noopener");
        return;
      }
      onClose();
      router.push(row.href);
      return;
    }
    onClose();
    row.run?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handled here only: the page's own shortcuts and open dialogs mustn't see these.
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "ArrowDown") {
      stop();
      if (rows.length) setActive((activeIndex + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      stop();
      if (rows.length) setActive((activeIndex - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      stop();
      if (activeIndex >= 0) choose(rows[activeIndex], e.metaKey || e.ctrlKey);
    } else if (e.key === "Escape") {
      stop();
      if (query) setQuery("");
      else onClose();
    } else if (e.key === "Tab") {
      stop();
    }
  };

  let optionIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[10vh] sm:pt-[16vh] bg-jira-navy/15 animate-in fade-in duration-100"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search issues, pages and projects"
        className="w-full max-w-[680px] rounded-2xl bg-white/95 sm:bg-white/85 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_24px_80px_rgba(9,30,66,0.30),0_2px_8px_rgba(9,30,66,0.12)] ring-1 ring-black/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 px-4 h-14">
          <Search className="w-6 h-6 text-jira-gray-500 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            id="spotlight-input"
            type="text"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="spotlight-results"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search issues, pages and projects"
            className="flex-1 min-w-0 bg-transparent outline-none text-[22px] font-light text-jira-navy placeholder:text-jira-gray-500"
          />
          {searching && <Loader2 className="w-4 h-4 text-jira-gray-500 animate-spin shrink-0" aria-label="Searching" />}
        </div>

        {(rows.length > 0 || (q && !searching)) && (
          <div
            id="spotlight-results"
            role="listbox"
            aria-label="Results"
            className="border-t border-black/5 max-h-[min(440px,60vh)] overflow-y-auto overscroll-contain px-2 py-2"
          >
            {rows.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-jira-gray-600">
                No results for <span className="font-semibold text-jira-navy">“{q}”</span>. Try an issue key such as{" "}
                <span className="font-mono">{currentProjectKey ?? "APOLLO"}-12</span>.
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} role="presentation" className="pb-1">
                <div role="presentation" className="px-3 pt-2 pb-1 text-xs font-semibold text-jira-gray-500">
                  {group.label}
                </div>
                {group.rows.map((row) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={row.id}
                      id={`spotlight-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => {
                        if (index !== activeIndex) setActive(index);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => choose(row, e.metaKey || e.ctrlKey)}
                      className={`flex items-center gap-3 px-2 h-11 rounded-lg text-sm cursor-pointer select-none ${
                        isActive ? "bg-jira-blue text-white" : "text-jira-navy"
                      }`}
                    >
                      {row.render(isActive)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="hidden sm:flex items-center gap-4 px-4 h-9 border-t border-black/5 text-xs text-jira-gray-600 bg-white/40">
          <span className="flex items-center gap-1.5">
            <Keys keys={["↑", "↓"]} active={false} /> to move
          </span>
          <span className="flex items-center gap-1.5">
            <Keys keys={["↵"]} active={false} /> to open
          </span>
          <span className="flex items-center gap-1.5">
            <Keys keys={[modKey, "↵"]} active={false} /> in a new tab
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Keys keys={["esc"]} active={false} /> to close
          </span>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {q && !searching ? `${rows.length} results` : ""}
      </span>
    </div>
  );
}
