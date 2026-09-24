"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Project } from "@/types";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { useShellCounts } from "@/hooks/useShellCounts";
import { useCurrentUser } from "@/context/UserContext";
import { Sheet, SheetContent } from "@/components/ui/Dialog";
import Rail from "./Rail";
import TopBar from "./TopBar";
import TabBar from "./TabBar";

const COLLAPSED_KEY = "trackr:rail-collapsed";

export interface AppShellProps {
  /** Projects for the rail; it shows the ones you belong to. */
  projects: Project[];
  currentProject?: Project | null;
  onCreateIssue?: () => void;
  onCreateProject?: () => void;
  children: React.ReactNode;
}

/**
 * The app's layout: the rail on the left, a slim top bar, and the page. On a
 * phone the rail becomes a tab bar along the bottom, whose More opens the
 * full rail as a sheet.
 */
export default function AppShell({ projects, currentProject, onCreateIssue, onCreateProject, children }: AppShellProps) {
  const pathname = usePathname();
  const { registerToggleSidebar } = useKeyboardShortcutsContext();
  const { currentUser } = useCurrentUser();
  // Signed-out visitors (public projects) have no Home, Inbox or counts.
  const counts = useShellCounts(!!currentUser);
  const [collapsed, setCollapsed] = useState(false);
  const [phoneRailOpen, setPhoneRailOpen] = useState(false);

  // Remembered per browser; the layout renders expanded until it's read.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => registerToggleSidebar(toggleCollapsed), [registerToggleSidebar, toggleCollapsed]);

  // Following a link closes the phone sheet.
  useEffect(() => setPhoneRailOpen(false), [pathname]);

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-page text-ink antialiased">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-surface px-3 py-2 text-[13px] font-medium text-ink shadow-overlay focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <div className="hidden md:flex">
        <Rail
          projects={projects}
          currentProject={currentProject}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onCreateProject={onCreateProject}
          counts={counts}
        />
      </div>

      <Sheet open={phoneRailOpen} onOpenChange={setPhoneRailOpen}>
        <SheetContent side="left" title="Navigation" showTitle={false} className="w-auto max-w-none"
          bodyClassName="p-0">
          <Rail
            projects={projects}
            currentProject={currentProject}
            collapsed={false}
            onCreateProject={
              onCreateProject
                ? () => {
                    setPhoneRailOpen(false);
                    onCreateProject();
                  }
                : undefined
            }
            counts={counts}
            onNavigate={() => setPhoneRailOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar currentProject={currentProject} onCreateIssue={onCreateIssue} onOpenRail={() => setPhoneRailOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface focus-visible:outline-none">
          {children}
        </main>
        <TabBar
          project={currentProject ?? projects[0] ?? null}
          unread={counts.unread}
          signedIn={!!currentUser}
          onMore={() => setPhoneRailOpen(true)}
        />
      </div>
    </div>
  );
}
