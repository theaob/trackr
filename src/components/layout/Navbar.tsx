"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Project, User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import NotificationsMenu from "./NotificationsMenu";
import {
  Search,
  Plus,
  ChevronDown,
  Layers,
  HelpCircle,
  Bell,
  Check,
  FolderGit2,
  KeyRound,
  Shield,
} from "lucide-react";
import PersonalAccessTokensModal from "@/components/auth/PersonalAccessTokensModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { resolveUserProjectRole, ROLE_CONFIG } from "@/lib/permissions";

interface NavbarProps {
  projects: Project[];
  currentProject: Project;
  onCreateIssueClick?: () => void;
  onCreateProjectClick?: () => void;
}

export default function Navbar({
  projects,
  currentProject,
  onCreateIssueClick,
  onCreateProjectClick,
}: NavbarProps) {
  const { currentUser, users, setCurrentUser } = useCurrentUser();
  const permissions = useProjectPermissions(currentProject);
  const { searchQuery, setSearchQuery } = useSearch();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);


  return (
    <header className="h-14 border-b border-jira-gray-300 bg-white px-4 flex items-center justify-between select-none z-30 relative shadow-sm">
      {/* Left side: Logo & Navigation */}
      <div className="flex items-center gap-6">
        <Link
          href={`/projects/${currentProject.key}/board`}
          className="flex items-center gap-2 group hover:opacity-95 transition-opacity"
        >
          <TrackrLogo size="md" />
        </Link>

        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProjectMenu(!showProjectMenu);
              setShowUserMenu(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium text-jira-navy hover:bg-jira-gray-100 transition-colors"
          >
            <FolderGit2 className="w-4 h-4 text-jira-blue" />
            <span>{currentProject.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-jira-gray-600" />
          </button>

          {showProjectMenu && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-jira-gray-300 rounded-md shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-2 text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wider border-b border-jira-gray-200">
                Recent Projects
              </div>
              {projects.map((proj) => (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.key}/board`}
                  onClick={() => setShowProjectMenu(false)}
                  className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-jira-gray-100 ${
                    proj.id === currentProject.id ? "bg-jira-blue-light/50 font-semibold text-jira-blue" : "text-jira-navy"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-6 h-6 rounded bg-jira-gray-200 text-jira-gray-800 text-xs font-bold flex items-center justify-center">
                      {proj.key.slice(0, 2)}
                    </span>
                    <span className="truncate">{proj.name}</span>
                  </div>
                  {proj.id === currentProject.id && <Check className="w-4 h-4 text-jira-blue shrink-0" />}
                </Link>
              ))}

              <div className="pt-1 mt-1 border-t border-jira-gray-200">
                <Link
                  href="/projects"
                  onClick={() => setShowProjectMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-jira-gray-700 hover:bg-jira-gray-100 hover:text-jira-navy transition-colors"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-jira-blue" />
                  <span>View all projects</span>
                </Link>
                {onCreateProjectClick && (
                  <button
                    onClick={() => {
                      setShowProjectMenu(false);
                      onCreateProjectClick();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-jira-blue hover:bg-jira-gray-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create project</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Global Create Button */}
        {onCreateIssueClick && (
          <button
            onClick={onCreateIssueClick}
            disabled={permissions.isViewer}
            title={permissions.isViewer ? "Viewers cannot create issues in this project" : undefined}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded flex items-center gap-1.5 shadow-sm transition-colors ${
              permissions.isViewer
                ? "bg-jira-gray-200 text-jira-gray-400 cursor-not-allowed opacity-60"
                : "bg-jira-blue hover:bg-jira-blue-hover text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        )}
      </div>

      {/* Right side: Search & User Controls */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
          <input
            type="text"
            placeholder="Search issues, keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-jira-gray-100 hover:bg-jira-gray-200 focus:bg-white border border-transparent focus:border-jira-blue rounded transition-all outline-none text-jira-navy"
          />
        </div>

        {/* Help & Notification icons */}
        <button className="p-2 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded-full transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <NotificationsMenu />

        {/* Current User Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowProjectMenu(false);
            }}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full hover:bg-jira-gray-100 transition-colors border border-transparent hover:border-jira-gray-300"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-jira-gray-300"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-jira-blue text-white text-xs font-bold flex items-center justify-center">
                {currentUser?.name.charAt(0) || "U"}
              </div>
            )}
            <span className="text-xs font-medium text-jira-navy hidden sm:inline max-w-[100px] truncate">
              {currentUser?.name}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border hidden md:inline ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
            <ChevronDown className="w-3 h-3 text-jira-gray-600" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-jira-gray-300 rounded-md shadow-xl py-1 z-50 animate-in fade-in">
              <div className="px-3 py-2 border-b border-jira-gray-200">
                <p className="text-xs font-bold text-jira-navy">{currentUser?.name}</p>
                <p className="text-[11px] text-jira-gray-600">{currentUser?.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] bg-jira-gray-100 text-jira-gray-700 font-semibold px-2 py-0.5 rounded">
                    {currentUser?.role}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
                  >
                    {currentProject.key}: {permissions.roleConfig.name}
                  </span>
                </div>
              </div>

              {/* Personal Access Tokens Trigger */}
              <div className="py-1 border-b border-jira-gray-200">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowTokensModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-jira-navy hover:bg-jira-gray-100 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-jira-blue" />
                  <span>Personal Access Tokens</span>
                </button>
              </div>

              <div className="px-3 py-1.5 text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wider">
                Switch Teammate (Simulated Session)
              </div>

              {users.map((u) => {
                const uRole = resolveUserProjectRole(u.id, currentProject);
                const uRoleCfg = ROLE_CONFIG[uRole];

                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setCurrentUser(u);
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-jira-gray-100 transition-colors ${
                      u.id === currentUser?.id ? "bg-jira-blue-light/50 font-semibold text-jira-blue" : "text-jira-navy"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-jira-gray-300 text-jira-gray-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {u.name.charAt(0)}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-xs font-medium truncate">{u.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-jira-gray-600">
                          <span>{u.role}</span>
                          <span>•</span>
                          <span
                            className={`font-semibold px-1 py-0.2 rounded text-[9px] border ${uRoleCfg.badgeBg} ${uRoleCfg.badgeText} ${uRoleCfg.border}`}
                          >
                            {uRoleCfg.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    {u.id === currentUser?.id && <Check className="w-4 h-4 text-jira-blue shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Personal Access Tokens Modal */}
      <PersonalAccessTokensModal
        isOpen={showTokensModal}
        onClose={() => setShowTokensModal(false)}
      />
    </header>
  );
}

