/**
 * The redesigned app shell: where the viewer is (for the top bar's
 * breadcrumb and the rail's highlight), what they viewed recently, and how
 * Home groups due dates. Pure, so it runs anywhere and is tested directly.
 */
import { addDays, format } from "date-fns";
import { calendarDateKey, todayKey } from "@/lib/calendarDate";
import { PROJECT_PAGES, type SpotlightPageId } from "@/lib/spotlight";

export type ShellSection = "home" | "inbox" | "projects" | "system-settings" | "project" | "other";

export interface ShellLocation {
  section: ShellSection;
  /** Upper-case key when inside a project. */
  projectKey?: string;
  pageId?: SpotlightPageId;
  /** What the page is called in the top bar. */
  title: string;
}

/** The short name of each project page, as the rail and breadcrumb show it. */
export function projectPageTitle(pageId: SpotlightPageId): string {
  return pageId === "settings" ? "Settings" : PROJECT_PAGES.find((p) => p.id === pageId)?.title ?? pageId;
}

export function shellLocation(pathname: string | null | undefined): ShellLocation {
  const path = (pathname ?? "").split(/[?#]/)[0];
  const project = path.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  if (project) {
    const projectKey = decodeURIComponent(project[1]).toUpperCase();
    const page = PROJECT_PAGES.find((p) => p.id === project[2]);
    return page
      ? { section: "project", projectKey, pageId: page.id, title: projectPageTitle(page.id) }
      : { section: "project", projectKey, title: projectKey };
  }
  if (path === "/home") return { section: "home", title: "Home" };
  if (path === "/inbox") return { section: "inbox", title: "Inbox" };
  if (path === "/projects") return { section: "projects", title: "Projects" };
  if (path === "/settings") return { section: "system-settings", title: "System settings" };
  return { section: "other", title: "Trackr" };
}

/** Two letters for a project's square in the rail. */
export function projectInitials(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

// ---- Recently viewed issues --------------------------------------------------

export interface RecentIssue {
  key: string;
  title: string;
  projectKey: string;
  /** When it was last opened, in ms since the epoch. */
  viewedAt: number;
}

export const RECENT_ISSUES_LIMIT = 8;

/** The list with `entry` moved to the front, duplicates of its key dropped. */
export function pushRecentIssue(list: RecentIssue[], entry: RecentIssue, limit = RECENT_ISSUES_LIMIT): RecentIssue[] {
  return [entry, ...list.filter((item) => item.key !== entry.key)].slice(0, limit);
}

/**
 * Reads a stored list, keeping only well-formed entries: it comes from the
 * browser's storage, which anything on the page could have written.
 */
export function parseRecentIssues(raw: string | null | undefined): RecentIssue[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RecentIssue =>
          !!item &&
          typeof item.key === "string" &&
          /^[A-Z][A-Z0-9]*-\d+$/.test(item.key) &&
          typeof item.title === "string" &&
          typeof item.projectKey === "string" &&
          typeof item.viewedAt === "number"
      )
      .map((item) => ({ key: item.key, title: item.title.slice(0, 300), projectKey: item.projectKey, viewedAt: item.viewedAt }))
      .slice(0, RECENT_ISSUES_LIMIT);
  } catch {
    return [];
  }
}

/** Per account, so two people sharing a browser don't see each other's history. */
export function recentIssuesStorageKey(userId: string): string {
  return `trackr:recent-issues:${userId}`;
}

// ---- Home: due dates ------------------------------------------------------------

export type DueBucket = "overdue" | "today" | "week" | "later";

/** How far off a calendar due date is for the viewer: past, today, the next 7 days, or later. */
export function dueBucket(dueDate: string | Date, now: Date = new Date()): DueBucket {
  const due = calendarDateKey(dueDate);
  const today = todayKey(now);
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due <= format(addDays(now, 7), "yyyy-MM-dd")) return "week";
  return "later";
}

/** Issues due within a week or already late, earliest first, grouped by bucket. */
export function groupDueSoon<T extends { dueDate?: string | Date | null }>(
  issues: T[],
  now: Date = new Date()
): { bucket: Exclude<DueBucket, "later">; issues: T[] }[] {
  const buckets: Record<Exclude<DueBucket, "later">, T[]> = { overdue: [], today: [], week: [] };
  const dated = issues
    .filter((issue): issue is T & { dueDate: string | Date } => !!issue.dueDate)
    .sort((a, b) => calendarDateKey(a.dueDate).localeCompare(calendarDateKey(b.dueDate)));
  for (const issue of dated) {
    const bucket = dueBucket(issue.dueDate, now);
    if (bucket !== "later") buckets[bucket].push(issue);
  }
  return (["overdue", "today", "week"] as const)
    .map((bucket) => ({ bucket, issues: buckets[bucket] }))
    .filter((group) => group.issues.length > 0);
}

/**
 * Whether someone is on a project's team (its lead or a member), as opposed
 * to merely able to read it because it's published: the rail and Home list
 * your projects, not every public one on the instance.
 */
export function isProjectMember(
  userId: string | null | undefined,
  project: { leadId?: string | null; members?: { userId: string }[] | null }
): boolean {
  if (!userId) return false;
  return project.leadId === userId || !!project.members?.some((m) => m.userId === userId);
}
