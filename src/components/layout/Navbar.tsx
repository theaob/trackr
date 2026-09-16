"use client";

import React, { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Camera,
  Trash2,
  Loader2,
  LogOut,
} from "lucide-react";
import PersonalAccessTokensModal from "@/components/auth/PersonalAccessTokensModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";
import UserAvatar from "@/components/common/UserAvatar";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { resolveUserProjectRole } from "@/lib/permissions";
import { logout } from "@/lib/actions/auth";

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
  const router = useRouter();
  const { currentUser, users, setCurrentUser, setUsers } = useCurrentUser();
  const permissions = useProjectPermissions(currentProject);
  const { searchQuery, setSearchQuery } = useSearch();

  const accessibleProjects = useMemo(() => {
    if (!currentUser) return projects;
    return projects.filter((proj) => resolveUserProjectRole(currentUser.id, proj) !== null);
  }, [projects, currentUser]);

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch(`/api/v1/users/${currentUser.id}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentUser({ ...currentUser, avatarUrl: data.user.avatarUrl });
        setUsers(users.map((u) => u.id === currentUser.id ? { ...u, avatarUrl: data.user.avatarUrl } : u));
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    if (!currentUser) return;

    setAvatarUploading(true);
    try {
      const res = await fetch(`/api/v1/users/${currentUser.id}/avatar`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCurrentUser({ ...currentUser, avatarUrl: null });
        setUsers(users.map((u) => u.id === currentUser.id ? { ...u, avatarUrl: null } : u));
      }
    } catch (err) {
      console.error("Avatar delete failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };


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
              {accessibleProjects.map((proj) => (
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
            <UserAvatar user={currentUser} size="md" className="border border-jira-gray-300" />
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

              {/* Avatar Management */}
              <div className="py-1 border-b border-jira-gray-200">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-1 px-2">
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="flex-1 flex items-center gap-2.5 px-1 py-2 text-xs font-medium text-jira-navy hover:bg-jira-gray-100 transition-colors rounded disabled:opacity-50"
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-3.5 h-3.5 text-jira-blue animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-jira-blue" />
                    )}
                    <span>{currentUser?.avatarUrl ? "Change Avatar" : "Upload Avatar"}</span>
                  </button>
                  {currentUser?.avatarUrl && (
                    <button
                      onClick={handleAvatarDelete}
                      disabled={avatarUploading}
                      className="p-2 text-jira-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove avatar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Access Tokens */}
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

              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-jira-navy hover:bg-jira-gray-100 transition-colors disabled:opacity-50"
                >
                  {signingOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-gray-500" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5 text-jira-gray-600" />
                  )}
                  <span>Sign out</span>
                </button>
              </div>
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

