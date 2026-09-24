/**
 * The ⌘K search panel: what it can jump to, and how matches are ranked.
 * Pure, so it runs in the browser, in server actions and in tests.
 */

import { issueHref } from "@/lib/issueUrls";

export type SpotlightPageId =
  | "board"
  | "backlog"
  | "roadmap"
  | "issues"
  | "reports"
  | "releases"
  | "settings";

export interface SpotlightProject {
  id: string;
  key: string;
  name: string;
}

export interface SpotlightDestination {
  /** Unique across the list. */
  id: string;
  kind: "project" | "page";
  title: string;
  /** The project a page belongs to. */
  subtitle?: string;
  href: string;
  pageId?: SpotlightPageId | "projects" | "system-settings";
  projectKey?: string;
  /** A page of the project being viewed. */
  current?: boolean;
  /** Extra words that should find this destination. */
  keywords: string;
}

export interface SpotlightIssue {
  id: string;
  key: string;
  title: string;
  type: string;
  status: string;
  statusColor?: string;
  projectKey: string;
  projectName: string;
}

/** Longer queries are cut to this before they reach the database. */
export const SPOTLIGHT_MAX_QUERY = 100;

/** The same names and order as the project sidebar and the rail. */
export const PROJECT_PAGES: { id: SpotlightPageId; title: string; keywords: string; signedInOnly?: boolean }[] = [
  { id: "board", title: "Board", keywords: "board active kanban sprint columns" },
  { id: "backlog", title: "Backlog", keywords: "sprints planning" },
  { id: "roadmap", title: "Roadmap", keywords: "epics timeline" },
  { id: "issues", title: "Issues", keywords: "list navigator search tql filter" },
  { id: "reports", title: "Reports", keywords: "burndown velocity cumulative flow workload charts" },
  { id: "releases", title: "Releases", keywords: "versions fix version" },
  {
    id: "settings",
    title: "Project Settings",
    keywords: "workflow statuses members access roles webhooks custom fields components",
    signedInOnly: true,
  },
];

/** The existing "g then …" shortcut for each page, shown beside it. */
export const PAGE_SHORTCUTS: Record<string, string[]> = {
  board: ["G", "D"],
  backlog: ["G", "B"],
  issues: ["G", "I"],
  roadmap: ["G", "R"],
  releases: ["G", "L"],
  reports: ["G", "E"],
  settings: ["G", "S"],
  projects: ["G", "P"],
};

/** Every project, every page of every project, and the global pages. */
export function buildSpotlightDestinations(options: {
  projects: SpotlightProject[];
  currentProjectKey?: string | null;
  signedIn: boolean;
  instanceAdmin: boolean;
}): SpotlightDestination[] {
  const { projects, signedIn, instanceAdmin } = options;
  const currentKey = options.currentProjectKey?.toUpperCase() ?? null;
  const pages = PROJECT_PAGES.filter((p) => signedIn || !p.signedInOnly);

  // The current project first, so its pages win ties.
  const ordered = [...projects].sort(
    (a, b) => Number(b.key === currentKey) - Number(a.key === currentKey)
  );

  const destinations: SpotlightDestination[] = [];
  for (const project of ordered) {
    const current = project.key === currentKey;
    destinations.push({
      id: `project:${project.key}`,
      kind: "project",
      title: project.name,
      subtitle: project.key,
      href: `/projects/${project.key}/board`,
      projectKey: project.key,
      current,
      keywords: "project",
    });
    for (const page of pages) {
      destinations.push({
        id: `page:${project.key}:${page.id}`,
        kind: "page",
        title: page.title,
        subtitle: project.name,
        href: `/projects/${project.key}/${page.id}`,
        pageId: page.id,
        projectKey: project.key,
        current,
        keywords: page.keywords,
      });
    }
  }

  destinations.push({
    id: "page:projects",
    kind: "page",
    title: "All Projects",
    href: "/projects",
    pageId: "projects",
    keywords: "projects directory",
  });
  if (instanceAdmin) {
    destinations.push({
      id: "page:system-settings",
      kind: "page",
      title: "System Settings",
      href: "/settings",
      pageId: "system-settings",
      keywords: "instance admin users sso single sign-on system info",
    });
  }
  return destinations;
}

function tokenize(query: string): string[] {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/**
 * Destinations matching every word of the query, best first. A word can match
 * the title, the project's name or key, or a page's keywords, so "orion
 * backlog" finds Orion's backlog and "burndown" finds Reports.
 */
export function rankDestinations(
  query: string,
  destinations: SpotlightDestination[],
  limit = destinations.length
): SpotlightDestination[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return destinations.slice(0, limit);
  const phrase = tokens.join(" ");

  const scored: { d: SpotlightDestination; score: number; index: number }[] = [];
  destinations.forEach((d, index) => {
    const title = d.title.toLowerCase();
    const haystack = `${title} ${(d.subtitle ?? "").toLowerCase()} ${(d.projectKey ?? "").toLowerCase()} ${d.keywords}`;
    if (!tokens.every((t) => haystack.includes(t))) return;

    let score = 0;
    if (title === phrase) score += 120;
    else if (title.startsWith(phrase)) score += 100;
    else if (title.split(/\s+/).some((word) => word.startsWith(tokens[0]))) score += 60;
    else if (title.includes(tokens[0])) score += 40;
    if (d.projectKey && tokens.includes(d.projectKey.toLowerCase())) score += 30;
    if (d.current) score += 25;
    if (d.kind === "project") score += 10;
    scored.push({ d, score, index });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.d);
}

/**
 * The issue key a query names outright: "apollo-3" is APOLLO-3 anywhere, and
 * a bare number is that issue in the project being viewed.
 */
export function issueKeyForQuery(query: string, currentProjectKey?: string | null): string | null {
  const q = query.trim();
  if (/^[a-z][a-z0-9]*-\d+$/i.test(q)) return q.toUpperCase();
  if (/^\d+$/.test(q) && currentProjectKey) return `${currentProjectKey.toUpperCase()}-${Number(q)}`;
  return null;
}

/**
 * Whether every word appears, literally and ignoring case, in the issue's key
 * or title. The database's LIKE treats % and _ as wildcards, so its matches
 * are only candidates until they pass this.
 */
export function matchesEveryWord(issue: { key: string; title: string }, query: string): boolean {
  const text = `${issue.key} ${issue.title}`.toLowerCase();
  return tokenize(query).every((word) => text.includes(word));
}

/**
 * Order issue matches: the exact key first, then keys and titles that start
 * with the query, then the project being viewed. Otherwise keeps the incoming
 * order, which is most recently updated first.
 */
export function rankIssueMatches<T extends { key: string; title: string; project: { key: string } }>(
  query: string,
  issues: T[],
  currentProjectKey?: string | null
): T[] {
  const q = query.trim().toLowerCase();
  const exactKey = issueKeyForQuery(query, currentProjectKey)?.toLowerCase();
  const currentKey = currentProjectKey?.toLowerCase();

  return issues
    .map((issue, index) => {
      const key = issue.key.toLowerCase();
      const title = issue.title.toLowerCase();
      let score = 0;
      if (key === exactKey || key === q) score += 1000;
      else if (key.startsWith(q)) score += 500;
      if (title.startsWith(q)) score += 200;
      else if (title.includes(q)) score += 100;
      if (currentKey && issue.project.key.toLowerCase() === currentKey) score += 50;
      return { issue, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.issue);
}

/** Where an issue opens: its own page. */
export function spotlightIssueHref(projectKey: string, issueKey: string): string {
  return issueHref(projectKey, issueKey);
}

/** ⌘K on a Mac, Ctrl+K elsewhere. */
export function isSpotlightShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";
}

/** The project key in a /projects/KEY/… path. */
export function projectKeyFromPath(pathname: string | null | undefined): string | null {
  const match = pathname?.match(/^\/projects\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : null;
}

/** The pages whose issues can be filtered from the navbar's search box. */
export function filterablePage(pathname: string | null | undefined): "board" | "backlog" | "issues" | null {
  const match = pathname?.match(/^\/projects\/[^/]+\/(board|backlog|issues)(?:\/|$)/);
  return match ? (match[1] as "board" | "backlog" | "issues") : null;
}
