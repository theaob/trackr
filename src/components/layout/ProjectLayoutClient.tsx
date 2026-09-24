"use client";

import React, { useState } from "react";
import { Project, User, Sprint, Issue } from "@/types";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { SearchProvider } from "@/context/SearchContext";
import { StatusColorsProvider } from "@/context/StatusColorsContext";
import { useCurrentUser } from "@/context/UserContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useRouter } from "next/navigation";
import AppShell from "@/components/shell/AppShell";

interface ProjectLayoutClientProps {
  projects: Project[];
  currentProject: Project;
  users: User[];
  sprints: Sprint[];
  epics: Issue[];
  /** Workflow status colors, for status lozenges anywhere in the project. */
  statuses?: { name: string; color: string }[];
  children: React.ReactNode;
}

export default function ProjectLayoutClient({
  projects,
  currentProject,
  users,
  sprints,
  epics,
  statuses = [],
  children,
}: ProjectLayoutClientProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(currentProject);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const { registerCreateIssue, registerToggleSidebar } = useKeyboardShortcutsContext();

  React.useEffect(() => {
    if (!permissions.canCreateIssue) return;
    return registerCreateIssue(() => {
      setIsCreateModalOpen(true);
    });
  }, [registerCreateIssue, permissions.canCreateIssue]);

  const newLayout = !!currentUser?.useNewLayout;

  // The new layout's rail registers its own toggle.
  React.useEffect(() => {
    if (newLayout) return;
    return registerToggleSidebar(() => {
      setIsSidebarCollapsed((prev) => !prev);
    });
  }, [registerToggleSidebar, newLayout]);

  const openCreateIssue = permissions.canCreateIssue ? () => setIsCreateModalOpen(true) : undefined;
  const openCreateProject = currentUser?.canCreateProjects ? () => setIsCreateProjectModalOpen(true) : undefined;

  return (
    <SearchProvider>
      <StatusColorsProvider statuses={statuses}>
        {newLayout ? (
          <AppShell
            projects={projects}
            currentProject={currentProject}
            onCreateIssue={openCreateIssue}
            onCreateProject={openCreateProject}
          >
            {children}
          </AppShell>
        ) : (
          <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-jira-navy font-sans antialiased">
            {/* Top Navbar */}
            <Navbar
              projects={projects}
              currentProject={currentProject}
              onCreateIssueClick={openCreateIssue}
              onCreateProjectClick={openCreateProject}
              onToggleMobileMenu={() => setIsMobileDrawerOpen((prev) => !prev)}
            />

            {/* Main Workspace Body: Sidebar + Content */}
            <div className="flex-1 flex overflow-hidden">
              <Sidebar
                project={currentProject}
                collapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
                isMobileOpen={isMobileDrawerOpen}
                onCloseMobile={() => setIsMobileDrawerOpen(false)}
              />
              <main className="flex-1 flex flex-col overflow-hidden bg-white">{children}</main>
            </div>
          </div>
        )}

        {/* Global Create Issue Modal */}
        {isCreateModalOpen && permissions.canCreateIssue && (
          <CreateIssueModal
            project={currentProject}
            allProjects={projects}
            users={users}
            sprints={sprints}
            epics={epics}
            onClose={() => setIsCreateModalOpen(false)}
            onIssueCreated={() => {
              router.refresh();
            }}
          />
        )}

        {/* Global Create Project Modal */}
        {isCreateProjectModalOpen && currentUser?.canCreateProjects && (
          <CreateProjectModal
            users={users}
            onClose={() => setIsCreateProjectModalOpen(false)}
          />
        )}
      </StatusColorsProvider>
    </SearchProvider>
  );
}
