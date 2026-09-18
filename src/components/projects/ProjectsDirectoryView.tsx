"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { User } from "@/types";
import CreateProjectModal from "./CreateProjectModal";
import UserAvatar from "@/components/common/UserAvatar";
import { useCurrentUser } from "@/context/UserContext";
import { resolveUserProjectRole } from "@/lib/permissions";
import {
  FolderGit2,
  Plus,
  Search,
  Kanban,
  ListTodo,
  ListFilter,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface ProjectStats {
  id: string;
  name: string;
  key: string;
  description: string | null;
  lead: User | null;
  leadId?: string | null;
  members?: any[];
  totalIssues: number;
  openIssues: number;
  activeSprint?: string | null;
  boardType?: string;
}

interface ProjectsDirectoryViewProps {
  initialProjects: ProjectStats[];
  users: User[];
}

export default function ProjectsDirectoryView({
  initialProjects,
  users,
}: ProjectsDirectoryViewProps) {
  const { currentUser } = useCurrentUser();
  const [projects, setProjects] = useState<ProjectStats[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Without a session this leaves the projects published to anonymous viewers.
  const userAccessibleProjects = useMemo(
    () => projects.filter((p) => resolveUserProjectRole(currentUser?.id, p) !== null),
    [projects, currentUser]
  );

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return userAccessibleProjects;
    const q = searchQuery.toLowerCase();
    return userAccessibleProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
  }, [userAccessibleProjects, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-jira-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-jira-gray-200 px-8 py-6 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-jira-navy tracking-tight">Projects</h1>
            <p className="text-xs text-jira-gray-600 mt-1">
              Explore, manage, and switch between your workspace projects.
            </p>
          </div>

          {currentUser && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="max-w-7xl mx-auto mt-5">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
            <input
              type="text"
              placeholder="Search projects by name or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-jira-gray-100 hover:bg-jira-gray-200 focus:bg-white border border-transparent focus:border-jira-blue rounded-md transition-all outline-none text-jira-navy"
            />
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="p-8 max-w-7xl mx-auto w-full">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border border-jira-gray-300">
            <FolderGit2 className="w-10 h-10 text-jira-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-jira-navy">No projects found</h3>
            <p className="text-xs text-jira-gray-500 mt-1">
              Try adjusting your search query or create a new project.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg border border-jira-gray-300 hover:border-jira-blue hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  {/* Top: Icon + Name + Key */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-jira-blue-light text-jira-blue font-bold flex items-center justify-center text-sm border border-jira-blue/20">
                        {project.key.slice(0, 2)}
                      </div>
                      <div>
                        <Link
                          href={`/projects/${project.key}/board`}
                          className="text-base font-bold text-jira-navy group-hover:text-jira-blue transition-colors"
                        >
                          {project.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono font-semibold text-jira-gray-500">
                            {project.key}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-jira-gray-600 line-clamp-2 min-h-[32px] leading-relaxed mb-4">
                    {project.description || (
                      <span className="italic text-jira-gray-400">No description provided</span>
                    )}
                  </p>

                  {/* Stats & Lead */}
                  <div className="pt-3 border-t border-jira-gray-100 space-y-2 text-xs">
                    {/* Project Type */}
                    <div className="flex items-center justify-between text-jira-gray-600">
                      <span className="flex items-center gap-1.5 text-jira-gray-500">
                        {project.boardType === "KANBAN" ? (
                          <Kanban className="w-3.5 h-3.5 text-jira-gray-500" />
                        ) : (
                          <ListTodo className="w-3.5 h-3.5 text-jira-gray-500" />
                        )}
                        Type:
                      </span>
                      <span className="font-semibold text-jira-navy">
                        {project.boardType === "KANBAN" ? "Kanban" : "Scrum"}
                      </span>
                    </div>

                    {/* Issues Count */}
                    <div className="flex items-center justify-between text-jira-gray-600">
                      <span className="flex items-center gap-1.5 text-jira-gray-500">
                        <Layers className="w-3.5 h-3.5" />
                        Issues:
                      </span>
                      <span className="font-semibold text-jira-navy">
                        {project.openIssues} open / {project.totalIssues} total
                      </span>
                    </div>

                    {/* Project Lead */}
                    <div className="flex items-center justify-between text-jira-gray-600 pt-1">
                      <span className="flex items-center gap-1.5 text-jira-gray-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-jira-blue" />
                        Lead:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {project.lead && (
                          <UserAvatar user={project.lead} size="xs" />
                        )}
                        <span className="font-medium text-jira-navy">
                          {project.lead?.name || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Launch Actions */}
                <div className="px-5 py-3 bg-jira-gray-50 border-t border-jira-gray-200 flex items-center justify-between text-xs font-semibold text-jira-navy">
                  <Link
                    href={`/projects/${project.key}/board`}
                    className="flex items-center gap-1 hover:text-jira-blue transition-colors"
                  >
                    <Kanban className="w-3.5 h-3.5 text-jira-blue" />
                    <span>Board</span>
                  </Link>

                  <Link
                    href={`/projects/${project.key}/backlog`}
                    className="flex items-center gap-1 hover:text-jira-blue transition-colors"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-jira-gray-600" />
                    <span>Backlog</span>
                  </Link>

                  <Link
                    href={`/projects/${project.key}/issues`}
                    className="flex items-center gap-1 hover:text-jira-blue transition-colors"
                  >
                    <ListFilter className="w-3.5 h-3.5 text-jira-gray-600" />
                    <span>Issues</span>
                  </Link>

                  <Link
                    href={`/projects/${project.key}/settings`}
                    className="flex items-center gap-1 hover:text-jira-blue transition-colors"
                    title="Project Settings"
                  >
                    <Settings className="w-3.5 h-3.5 text-jira-gray-600" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <CreateProjectModal
          users={users}
          onClose={() => setIsCreateModalOpen(false)}
          onProjectCreated={(newProj) => {
            setProjects([
              {
                id: newProj.id,
                name: newProj.name,
                key: newProj.key,
                description: newProj.description,
                lead: newProj.lead,
                totalIssues: 0,
                openIssues: 0,
                activeSprint: null,
                boardType: newProj.boardType || "SCRUM",
              },
              ...projects,
            ]);
          }}
        />
      )}
    </div>
  );
}
