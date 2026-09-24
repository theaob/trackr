"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  LogIn,
  Inbox,
  Kanban,
  LayoutGrid,
  ListFilter,
  ListTodo,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import type { Project } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import { PROJECT_PAGES, type SpotlightPageId } from "@/lib/spotlight";
import { isProjectMember, projectInitials, projectPageTitle, shellLocation } from "@/lib/shell";
import { TrackrLogoIcon } from "@/components/common/TrackrLogo";
import { cn } from "@/components/ui/cn";
import AccountMenu from "./AccountMenu";

const PAGE_ICONS: Record<SpotlightPageId, React.ComponentType<{ className?: string }>> = {
  board: Kanban,
  backlog: ListTodo,
  roadmap: Map,
  issues: ListFilter,
  reports: BarChart3,
  releases: Rocket,
  settings: Settings,
};

export interface RailProps {
  projects: Project[];
  currentProject?: Project | null;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onCreateProject?: () => void;
  counts: { openIssues: number; unread: number };
  /** Called after following a link, so the phone sheet can close. */
  onNavigate?: () => void;
}

function Count({ value, label }: { value: number; label: string }) {
  if (value <= 0) return null;
  return (
    <>
      <span aria-hidden="true" className="ml-auto rounded-full bg-surface px-1.5 font-mono text-[11px] leading-5 text-ink-2">
        {value > 99 ? "99+" : value}
      </span>
      <span className="sr-only">, {label}</span>
    </>
  );
}

interface RailLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  trailing?: React.ReactNode;
  onNavigate?: () => void;
  indent?: boolean;
}

function RailLink({ href, icon, label, active, collapsed, trailing, onNavigate, indent }: RailLinkProps) {
  return (
    <Link
      prefetch={false}
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-control px-2 text-[13px] transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        active ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
        indent && !collapsed && "pl-8",
        collapsed && "justify-center px-0"
      )}
    >
      {icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </Link>
  );
}

/**
 * The left rail: the workspace, search, Home and Inbox,
 * then every project you belong to with the current one opened out.
 */
export default function Rail({
  projects,
  currentProject,
  collapsed,
  onToggleCollapsed,
  onCreateProject,
  counts,
  onNavigate,
}: RailProps) {
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();
  const { openSpotlight } = useKeyboardShortcutsContext();
  const modKey = useModKeyLabel();
  const location = shellLocation(pathname);

  // Projects you're on, plus the one being viewed (it may be a public one).
  const memberProjects = useMemo(() => {
    const mine = projects.filter((p) => isProjectMember(currentUser?.id, p));
    if (currentProject && !mine.some((p) => p.id === currentProject.id)) mine.unshift(currentProject);
    return mine;
  }, [projects, currentProject, currentUser?.id]);

  const pages = PROJECT_PAGES.filter((p) => currentUser || !p.signedInOnly);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-subtle bg-surface-sunk transition-[width] duration-150 motion-reduce:transition-none",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        <Link
          prefetch={false}
          href="/home"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 rounded-control"
          aria-label={collapsed ? "Trackr home" : undefined}
        >
          <TrackrLogoIcon size={24} />
          {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight text-ink">Trackr</span>}
        </Link>
        {!collapsed && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar ([)"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              openSpotlight();
            }}
            aria-label="Search or jump to"
            aria-keyshortcuts="Meta+K Control+K"
            title={collapsed ? `Search (${modKey} K)` : undefined}
            className={cn(
              "mb-1.5 flex h-8 items-center gap-2 rounded-control border border-subtle bg-surface px-2 text-[13px] text-muted transition-colors hover:border-strong hover:text-ink-2",
              collapsed && "justify-center px-0"
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">Search or jump to…</span>
                <kbd className="font-mono text-[11px] text-muted">{modKey === "⌘" ? "⌘K" : `${modKey} K`}</kbd>
              </>
            )}
          </button>
          {currentUser && (
            <>
            <RailLink
              href="/home"
              icon={<Home aria-hidden="true" />}
              label={collapsed && counts.openIssues > 0 ? `Home, ${counts.openIssues} open issues` : "Home"}
              active={location.section === "home"}
              collapsed={collapsed}
              onNavigate={onNavigate}
              trailing={<Count value={counts.openIssues} label={`${counts.openIssues} open issues assigned to you`} />}
            />
            <RailLink
              href="/inbox"
              icon={<Inbox aria-hidden="true" />}
              label={collapsed && counts.unread > 0 ? `Inbox, ${counts.unread} unread` : "Inbox"}
              active={location.section === "inbox"}
              collapsed={collapsed}
              onNavigate={onNavigate}
              trailing={<Count value={counts.unread} label={`${counts.unread} unread`} />}
            />
            </>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {!collapsed ? (
            <div className="flex h-7 items-center justify-between px-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Projects</h2>
              {onCreateProject && (
                <button
                  type="button"
                  onClick={onCreateProject}
                  aria-label="New project"
                  title="New project"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto my-1 h-px w-6 bg-strong" role="separator" />
          )}
          <ul className="flex flex-col gap-0.5">
            {memberProjects.map((project) => {
              const isCurrent = currentProject?.id === project.id;
              return (
                <li key={project.id}>
                  <RailLink
                    href={`/projects/${project.key}/board`}
                    icon={
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-semibold",
                          isCurrent ? "bg-accent text-accent-fg" : "bg-strong/60 text-ink-2"
                        )}
                      >
                        {projectInitials(project.key)}
                      </span>
                    }
                    label={project.name}
                    active={isCurrent && !location.pageId}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                  {isCurrent && (
                    <ul className="mt-0.5 flex flex-col gap-0.5" aria-label={`${project.name} pages`}>
                      {pages.map((page) => {
                        const Icon = PAGE_ICONS[page.id];
                        const title = projectPageTitle(page.id);
                        return (
                          <li key={page.id}>
                            <RailLink
                              href={`/projects/${project.key}/${page.id}`}
                              icon={<Icon aria-hidden="true" />}
                              label={collapsed ? `${project.name}: ${title}` : title}
                              active={location.pageId === page.id}
                              collapsed={collapsed}
                              onNavigate={onNavigate}
                              indent
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <RailLink
            href="/projects"
            icon={<LayoutGrid aria-hidden="true" />}
            label="All projects"
            active={location.section === "projects"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
          {currentUser?.isInstanceAdmin && (
            <RailLink
              href="/settings"
              icon={<Shield aria-hidden="true" />}
              label="System settings"
              active={location.section === "system-settings"}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}
        </div>
      </div>

      <div className={cn("shrink-0 border-t border-subtle p-2", collapsed && "flex flex-col items-center gap-1")}>
        {collapsed && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar ([)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {currentUser ? (
          <AccountMenu collapsed={collapsed} currentProject={currentProject} />
        ) : (
          <RailLink
            href={`/login?next=${encodeURIComponent(pathname || "/")}`}
            icon={<LogIn aria-hidden="true" />}
            label="Sign in"
            active={false}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </nav>
  );
}
