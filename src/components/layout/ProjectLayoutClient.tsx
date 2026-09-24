"use client";

import React, { useState } from "react";
import { Project, User, Sprint, Issue } from "@/types";
import QuickCreateIssue from "@/components/issues/QuickCreateIssue";
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

  const { registerCreateIssue } = useKeyboardShortcutsContext();

  React.useEffect(() => {
    if (!permissions.canCreateIssue) return;
    return registerCreateIssue(() => {
      setIsCreateModalOpen(true);
    });
  }, [registerCreateIssue, permissions.canCreateIssue]);

  const openCreateIssue = permissions.canCreateIssue ? () => setIsCreateModalOpen(true) : undefined;
  const openCreateProject = currentUser?.canCreateProjects ? () => setIsCreateProjectModalOpen(true) : undefined;

  return (
    <SearchProvider>
      <StatusColorsProvider statuses={statuses}>
        <AppShell
          projects={projects}
          currentProject={currentProject}
          onCreateIssue={openCreateIssue}
          onCreateProject={openCreateProject}
        >
          {children}
        </AppShell>

        {permissions.canCreateIssue && (
          <QuickCreateIssue
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            project={currentProject}
            allProjects={projects}
            users={users}
            sprints={sprints}
            epics={epics}
            onCreated={() => router.refresh()}
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
