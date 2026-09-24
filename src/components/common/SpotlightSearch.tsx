"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Copy,
  ExternalLink,
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
  UserCheck,
  ArrowRightLeft,
  Link2,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import { IssueTypeIcon, StatusBadge } from "@/components/common/IssueIcons";
import {
  getSpotlightIssueActions,
  getSpotlightProjects,
  searchSpotlightIssues,
  type SpotlightIssueActions,
} from "@/lib/actions/search";
import { updateIssue } from "@/lib/actions/issues";
import { readRecentIssues } from "@/lib/recentIssuesStore";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { useToast } from "@/components/ui/Toast";
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
  /** An issue row: → opens its actions. */
  issue?: { key: string; title: string };
  /** What typing matches, for rows in an issue's actions list. */
  searchText?: string;
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
            active ? "border-accent-fg/40 text-accent-fg/90" : "border-subtle text-ink-2 bg-surface/70"
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
        active ? "bg-accent-fg/20 text-accent-fg" : "bg-surface-sunk text-ink-2"
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
  const { toast } = useToast();
  // The actions list for one issue, entered with → on an issue row.
  const [actionsFor, setActionsFor] = useState<{ key: string; title: string } | null>(null);
  const [issueActions, setIssueActions] = useState<SpotlightIssueActions | null | "loading">(null);
  const recent = useMemo(() => readRecentIssues(currentUser?.id).slice(0, 5), [currentUser?.id]);

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
    if (!q || actionsFor) {
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
  }, [q, currentProjectKey, actionsFor]);

  useEffect(() => {
    setActive(0);
  }, [q, actionsFor]);

  const openActions = (issue: { key: string; title: string }) => {
    setActionsFor(issue);
    setQuery("");
    setIssueActions("loading");
    getSpotlightIssueActions(issue.key).then((result) => setIssueActions(result));
  };
  const closeActions = () => {
    setActionsFor(null);
    setIssueActions(null);
    setQuery("");
  };

  const runIssueUpdate = async (issueId: string, data: Parameters<typeof updateIssue>[1], done: string) => {
    const res = await updateIssue(issueId, data);
    if (res && "success" in res && res.success === false) {
      toast({ title: "Couldn't update the issue", description: res.error, tone: "danger" });
      return;
    }
    toast({ title: done, tone: "success" });
    router.refresh();
  };

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
                  isActive ? "bg-accent-fg/20 text-accent-fg" : "bg-accent-soft text-accent"
                }`}
              >
                {d.projectKey?.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{d.title}</span>
              {d.subtitle && (
                <span className={isActive ? "text-accent-fg/80" : "text-muted"}>
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

    const actionsHint = (isActive: boolean) =>
      isActive ? (
        <span className="hidden sm:flex items-center gap-1 shrink-0 text-xs text-accent-fg/80">
          <Keys keys={["→"]} active /> actions
        </span>
      ) : null;

    const issueRow = (issue: SpotlightIssue): Row => ({
      id: `issue:${issue.id}`,
      href: spotlightIssueHref(issue.projectKey, issue.key),
      issue: { key: issue.key, title: issue.title },
      render: (isActive) => (
        <>
          <span className="w-7 flex justify-center shrink-0">
            <IssueTypeIcon type={issue.type as IssueType} className="w-3.5 h-3.5" />
          </span>
          <span className={`font-mono text-xs shrink-0 ${isActive ? "text-accent-fg/90" : "text-ink-2"}`}>
            {issue.key}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
          {issue.projectKey !== currentProjectKey && (
            <span className={`hidden sm:inline text-xs shrink-0 ${isActive ? "text-accent-fg/80" : "text-muted"}`}>
              {issue.projectName}
            </span>
          )}
          {/* A white backing keeps the lozenge readable on the highlighted row. */}
          <span className={`hidden sm:inline-flex shrink-0 rounded ${isActive ? "bg-white" : ""}`}>
            <StatusBadge status={issue.status} color={issue.statusColor} className="max-w-[9rem]" />
          </span>
          {actionsHint(isActive)}
        </>
      ),
    });

    const recentRow = (item: { key: string; title: string; projectKey: string }): Row => ({
      id: `recent:${item.key}`,
      href: spotlightIssueHref(item.projectKey, item.key),
      issue: { key: item.key, title: item.title },
      render: (isActive) => (
        <>
          <span className="w-7 flex justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <span className={`font-mono text-xs shrink-0 ${isActive ? "text-accent-fg/90" : "text-ink-2"}`}>{item.key}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
          {actionsHint(isActive)}
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
    if (actionsFor) {
      const info = issueActions && issueActions !== "loading" ? issueActions : null;
      const href = spotlightIssueHref(info?.projectKey ?? actionsFor.key.replace(/-\d+$/, ""), actionsFor.key);
      const absolute = () => new URL(href, window.location.origin).toString();
      const copy = (text: string, what: string) => () => {
        navigator.clipboard?.writeText(text).then(
          () => toast({ title: `${what} copied`, tone: "success" }),
          () => toast({ title: `Couldn't copy the ${what.toLowerCase()}`, tone: "danger" })
        );
      };
      const rows: Row[] = [
        { ...actionRow("act:open", `Open ${actionsFor.key}`, <ExternalLink className="w-4 h-4" />, () => {}), run: undefined, href, searchText: "open view" },
        {
          ...actionRow("act:newtab", "Open in a new tab", <ExternalLink className="w-4 h-4" />, () => window.open(href, "_blank", "noopener"), [modKey, "↵"]),
          searchText: "open in a new tab window",
        },
      ];
      if (info?.canEdit && !info.assignedToMe && currentUser) {
        rows.push({
          ...actionRow("act:assign", "Assign to me", <UserCheck className="w-4 h-4" />, () =>
            runIssueUpdate(info.id, { assigneeId: currentUser.id }, `${info.key} assigned to you`)
          ),
          searchText: "assign to me take",
        });
      }
      for (const move of info?.moves ?? []) {
        const label = prettifyStatusName(move.name);
        rows.push({
          ...actionRow(`act:move:${move.name}`, <>Move to <span className="font-semibold">{label}</span></>, <ArrowRightLeft className="w-4 h-4" />, () =>
            runIssueUpdate(info!.id, { status: move.name }, `${info!.key} moved to ${label}`)
          ),
          searchText: `move to status ${label} ${move.name}`,
        });
      }
      rows.push({ ...actionRow("act:copy-link", "Copy link", <Link2 className="w-4 h-4" />, () => copy(absolute(), "Link")()), searchText: "copy link url share" });
      rows.push({ ...actionRow("act:copy-key", `Copy “${actionsFor.key}”`, <Copy className="w-4 h-4" />, copy(actionsFor.key, "Key")), searchText: `copy key ${actionsFor.key}` });
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const matching = rows.filter((r) => words.every((w) => (r.searchText ?? "").toLowerCase().includes(w)));
      result.push({ label: `Actions on ${actionsFor.key}`, rows: matching });
    } else if (!q) {
      if (recent.length > 0) result.push({ label: "Recently viewed", rows: recent.map(recentRow) });
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
    // runIssueUpdate and toast only close over stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, issues, destinations, currentProjectKey, filterable, onCreateIssue, onShowShortcuts, actionsFor, issueActions, recent, modKey, currentUser]);

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
    const input = e.currentTarget;
    const caretAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    const caretAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
    if (e.key === "ArrowRight" && !actionsFor && caretAtEnd && activeIndex >= 0 && rows[activeIndex]?.issue) {
      stop();
      openActions(rows[activeIndex].issue!);
      return;
    }
    if (actionsFor && ((e.key === "ArrowLeft" && caretAtStart) || (e.key === "Backspace" && !query))) {
      stop();
      closeActions();
      return;
    }
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
      else if (actionsFor) closeActions();
      else onClose();
    } else if (e.key === "Tab") {
      stop();
    }
  };

  let optionIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[10vh] sm:pt-[16vh] bg-ink/15 animate-in fade-in duration-100"
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
          {actionsFor ? (
            <button
              type="button"
              onClick={closeActions}
              aria-label={`Back to results (leaving actions on ${actionsFor.key})`}
              className="flex items-center gap-1 shrink-0 rounded-md bg-surface-sunk px-2 py-1 font-mono text-xs text-ink hover:bg-subtle"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              {actionsFor.key}
            </button>
          ) : (
            <Search className="w-6 h-6 text-muted shrink-0" aria-hidden="true" />
          )}
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
            placeholder={actionsFor ? `What to do with ${actionsFor.key}…` : "Search issues, pages and projects"}
            aria-label={actionsFor ? `Actions on ${actionsFor.key}` : "Search issues, pages and projects"}
            className="flex-1 min-w-0 bg-transparent text-[22px] font-light text-ink placeholder:text-muted focus-visible:outline-none"
          />
          {(searching || issueActions === "loading") && (
            <Loader2 className="w-4 h-4 text-muted animate-spin shrink-0" aria-label={searching ? "Searching" : "Loading actions"} />
          )}
        </div>

        {(rows.length > 0 || (q && !searching) || actionsFor) && (
          <div
            id="spotlight-results"
            role="listbox"
            aria-label="Results"
            className="border-t border-black/5 max-h-[min(440px,60vh)] overflow-y-auto overscroll-contain px-2 py-2"
          >
            {rows.length === 0 && actionsFor && (
              <div className="px-3 py-6 text-center text-sm text-ink-2">No action matches “{q}”.</div>
            )}
            {rows.length === 0 && !actionsFor && (
              <div className="px-3 py-6 text-center text-sm text-ink-2">
                No results for <span className="font-semibold text-ink">“{q}”</span>. Try an issue key such as{" "}
                <span className="font-mono">{currentProjectKey ?? "APOLLO"}-12</span>.
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} role="presentation" className="pb-1">
                <div role="presentation" className="px-3 pt-2 pb-1 text-xs font-semibold text-muted">
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
                        isActive ? "bg-accent text-accent-fg" : "text-ink"
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

        <div className="hidden sm:flex items-center gap-4 px-4 h-9 border-t border-black/5 text-xs text-ink-2 bg-white/40">
          <span className="flex items-center gap-1.5">
            <Keys keys={["↑", "↓"]} active={false} /> to move
          </span>
          <span className="flex items-center gap-1.5">
            <Keys keys={["↵"]} active={false} /> to open
          </span>
          <span className="flex items-center gap-1.5">
            <Keys keys={[modKey, "↵"]} active={false} /> in a new tab
          </span>
          <span className="flex items-center gap-1.5">
            <Keys keys={actionsFor ? ["←"] : ["→"]} active={false} /> {actionsFor ? "back" : "issue actions"}
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
