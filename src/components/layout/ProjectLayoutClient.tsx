"use client";

import React, { useState } from "react";
import { Project, User, Sprint, Issue } from "@/types";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { SearchProvider } from "@/context/SearchContext";
import { useCurrentUser } from "@/context/UserContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { useRouter } from "next/navigation";

interface ProjectLayoutClientProps {
  projects: Project[];
  currentProject: Project;
  users: User[];
  sprints: Sprint[];
  epics: Issue[];
  children: React.ReactNode;
}

export default function ProjectLayoutClient({
  projects,
  currentProject,
  users,
  sprints,
  epics,
  children,
}: ProjectLayoutClientProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const { registerCreateIssue, registerToggleSidebar } = useKeyboardShortcutsContext();

  React.useEffect(() => {
    return registerCreateIssue(() => {
      setIsCreateModalOpen(true);
    });
  }, [registerCreateIssue]);

  React.useEffect(() => {
    return registerToggleSidebar(() => {
      setIsSidebarCollapsed((prev) => !prev);
    });
  }, [registerToggleSidebar]);

  return (
    <SearchProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-jira-navy font-sans antialiased">
        {/* Top Navbar */}
        <Navbar
          projects={projects}
          currentProject={currentProject}
          onCreateIssueClick={() => setIsCreateModalOpen(true)}
          onCreateProjectClick={
            currentUser?.canCreateProjects
              ? () => setIsCreateProjectModalOpen(true)
              : undefined
          }
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

        {/* Global Create Issue Modal */}
        {isCreateModalOpen && (
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
      </div>
    </SearchProvider>
  );
}
