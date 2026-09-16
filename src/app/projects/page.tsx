import React from "react";
import { getAllProjectsWithStats, getAllUsers, getProjects } from "@/lib/actions/projects";
import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";
import Navbar from "@/components/layout/Navbar";
import { SearchProvider } from "@/context/SearchContext";

export default async function ProjectsPage() {
  const [projectsWithStats, users, allProjects] = await Promise.all([
    getAllProjectsWithStats(),
    getAllUsers(),
    getProjects(),
  ]);

  const defaultProject = allProjects.length > 0 ? allProjects[0] : null;

  return (
    <SearchProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
        {defaultProject && (
          <Navbar
            projects={allProjects as any}
            currentProject={defaultProject as any}
          />
        )}
        <main className="flex-1 flex overflow-hidden">
          <ProjectsDirectoryView
            initialProjects={projectsWithStats as any}
            users={users as any}
          />
        </main>
      </div>
    </SearchProvider>
  );
}
