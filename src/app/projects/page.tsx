import React from "react";
import { redirect } from "next/navigation";
import { getAllProjectsWithStats, getAllUsers, getProjects } from "@/lib/actions/projects";
import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";
import { getCurrentUser } from "@/lib/auth/session";
import ShellPage from "@/components/shell/ShellPage";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  const [projectsWithStats, users, allProjects] = await Promise.all([
    getAllProjectsWithStats(),
    // Returns [] without a session: the user directory is not public.
    getAllUsers(),
    getProjects(),
  ]);

  // A visitor with nothing to look at is better served by the sign-in screen.
  if (!user && allProjects.length === 0) redirect("/login");

  return (
    <ShellPage projects={allProjects as any} users={users as any}>
      <div className="flex flex-1 overflow-hidden">
        <ProjectsDirectoryView initialProjects={projectsWithStats as any} users={users as any} />
      </div>
    </ShellPage>
  );
}
