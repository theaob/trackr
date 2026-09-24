"use client";

import React, { useState } from "react";
import type { Project, User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { SearchProvider } from "@/context/SearchContext";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import AppShell from "./AppShell";

/**
 * A page outside any one project (Home, Inbox, Projects, System settings)
 * in the shell. `users` enables New project in the rail.
 */
export default function ShellPage({
  projects,
  users,
  children,
}: {
  projects: Project[];
  users?: User[];
  children: React.ReactNode;
}) {
  const { currentUser } = useCurrentUser();
  const [creatingProject, setCreatingProject] = useState(false);
  const canCreateProject = !!currentUser?.canCreateProjects && !!users;

  return (
    <SearchProvider>
      <AppShell projects={projects} onCreateProject={canCreateProject ? () => setCreatingProject(true) : undefined}>
        {children}
      </AppShell>
      {creatingProject && users && <CreateProjectModal users={users} onClose={() => setCreatingProject(false)} />}
    </SearchProvider>
  );
}
