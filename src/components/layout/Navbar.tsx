"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Project, User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { useSearch } from "@/context/SearchContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import NotificationsMenu from "./NotificationsMenu";
import {
  Menu,
  X,
  Search,
  Plus,
  ChevronDown,
  Layers,
  HelpCircle,
  Check,
  FolderGit2,
  KeyRound,
  Shield,
  Camera,
  Trash2,
  Loader2,
  LogOut,
  LogIn,
  Settings,
} from "lucide-react";
import PersonalAccessTokensModal from "@/components/auth/PersonalAccessTokensModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";
import UserAvatar from "@/components/common/UserAvatar";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { resolveUserProjectRole } from "@/lib/permissions";
import { logout } from "@/lib/actions/auth";

interface NavbarProps {
  projects: Project[];
  currentProject?: Project | null;
  onCreateIssueClick?: () => void;
  onCreateProjectClick?: () => void;
  onToggleMobileMenu?: () => void;
}

export default function Navbar({
  projects,
  currentProject,
  onCreateIssueClick,
  onCreateProjectClick,
  onToggleMobileMenu,
}: NavbarProps) {
  const pathname = usePathname();
  const { currentUser, users, setCurrentUser, setUsers } = useCurrentUser();
  const permissions = useProjectPermissions(currentProject);
  const { searchQuery, setSearchQuery } = useSearch();
  const { openShortcutsModal } = useKeyboardShortcutsContext();

  const accessibleProjects = useMemo(
    () => projects.filter((proj) => resolveUserProjectRole(currentUser?.id, proj) !== null),
    [projects, currentUser]
  );

  const isInstanceAdmin = !!currentUser?.isInstanceAdmin;

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(target)
      ) {
        setShowProjectMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      // Full navigation, for the same reason as sign-in: a client-side replace
      // racing a refresh can leave stale session state on screen.
      window.location.assign("/login");
    } catch {
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
    <header className="h-14 border-b border-jira-gray-300 bg-white px-3 sm:px-4 flex items-center justify-between select-none z-30 relative shadow-sm">
      {/* Full-width Mobile Search Bar Overlay */}
      {isMobileSearchOpen && (
        <div className="md:hidden absolute inset-0 bg-white z-50 px-3 flex items-center gap-2 border-b border-jira-gray-300 animate-in fade-in slide-in-from-top-1">
          <Search className="w-4 h-4 text-jira-blue shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search issues, keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 py-1.5 text-sm text-jira-navy outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 text-jira-gray-400 hover:text-jira-gray-600 transition-colors"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="text-xs font-semibold text-jira-blue hover:text-jira-blue-hover px-2 py-1 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Left side: Hamburger, Logo & Project Navigation */}
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-jira-gray-700 hover:text-jira-navy hover:bg-jira-gray-100 rounded-md transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link
          href={currentProject ? `/projects/${currentProject.key}/board` : "/projects"}
          className="flex items-center gap-2 group hover:opacity-95 transition-opacity shrink-0"
        >
          <TrackrLogo size="md" />
        </Link>

        {/* Project Selector (Desktop) */}
        <div ref={projectMenuRef} className="hidden md:block relative min-w-0">
          <button
            onClick={() => {
              setShowProjectMenu(!showProjectMenu);
              setShowUserMenu(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1 rounded text-jira-navy hover:bg-jira-gray-100 transition-colors text-left max-w-[130px] sm:max-w-none truncate"
          >
            <FolderGit2 className="w-4 h-4 text-jira-blue shrink-0" />
            <div className="flex flex-col leading-none text-left min-w-0 truncate">
              <span className="text-xs sm:text-sm font-medium truncate max-w-[90px] sm:max-w-[240px]">
                {currentProject ? currentProject.name : "Select Project"}
              </span>
              {currentProject && (
                <span className="text-[10px] font-medium text-jira-gray-500 tracking-wider mt-0.5">
                  {currentProject.key}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-jira-gray-600 shrink-0" />
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
                    proj.id === currentProject?.id ? "bg-jira-blue-light/50 font-semibold text-jira-blue" : "text-jira-navy"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-6 h-6 rounded bg-jira-gray-200 text-jira-gray-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {proj.key.slice(0, 2)}
                    </span>
                    <div className="flex flex-col leading-tight truncate">
                      <span className="truncate">{proj.name}</span>
                      <span className="text-[10px] font-medium text-jira-gray-500 tracking-wider">{proj.key}</span>
                    </div>
                  </div>
                  {proj.id === currentProject?.id && <Check className="w-4 h-4 text-jira-blue shrink-0" />}
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
                {currentUser?.canCreateProjects && onCreateProjectClick && (
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
            disabled={!permissions.canCreateIssue}
            title={!permissions.canCreateIssue ? "You do not have permission to create issues in this project" : undefined}
            className={`text-sm font-semibold px-2.5 sm:px-3.5 py-1.5 rounded flex items-center gap-1.5 shadow-sm transition-colors shrink-0 ${
              !permissions.canCreateIssue
                ? "bg-jira-gray-200 text-jira-gray-400 cursor-not-allowed opacity-60"
                : "bg-jira-blue hover:bg-jira-blue-hover text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>
        )}
      </div>

      {/* Right side: Search & User Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

        {/* Mobile Search Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen(true)}
          className="md:hidden p-2 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded-full transition-colors"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Desktop Quick Search */}
        <div className="hidden md:block relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search issues, keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-jira-gray-100 hover:bg-jira-gray-200 focus:bg-white border border-transparent focus:border-jira-blue rounded transition-all outline-none text-jira-navy"
          />
          {!searchQuery && (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-jira-gray-400 bg-jira-gray-200/60 border border-jira-gray-300 rounded px-1.5 py-0.5 pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Help & Notification icons */}
        <button
          onClick={openShortcutsModal}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="hidden sm:flex p-2 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded-full transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {currentUser && <NotificationsMenu />}

        {/* Current User Switcher */}
        <div className="relative">
          {!currentUser ? (
            // Anonymous visitor on a project published for read-only access.
            <Link
              href={`/login?next=${encodeURIComponent(pathname || "/projects")}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </Link>
          ) : (
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
              className={`text-[9px] font-bold px-1.5 py-px rounded border hidden md:inline ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
            <ChevronDown className="w-3 h-3 text-jira-gray-600" />
          </button>
          )}

          {currentUser && showUserMenu && (
            <div ref={userMenuRef} className="absolute right-0 top-full mt-1 w-72 bg-white border border-jira-gray-300 rounded-md shadow-xl py-1 z-50 animate-in fade-in">
              <div className="px-3 py-2 border-b border-jira-gray-200">
                <p className="text-xs font-bold text-jira-navy">{currentUser?.name}</p>
                <p className="text-[11px] text-jira-gray-600">{currentUser?.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] bg-jira-gray-100 text-jira-gray-700 font-semibold px-2 py-0.5 rounded">
                    {currentUser?.role}
                  </span>
                  {currentProject && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
                    >
                      {currentProject.key}: {permissions.roleConfig.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Projects (Mobile Quick Switcher) */}
              <div className="md:hidden py-1 border-b border-jira-gray-200">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Switch Project</span>
                  {currentProject && (
                    <span className="text-[10px] font-bold text-jira-blue">
                      {currentProject.key}
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {accessibleProjects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.key}/board`}
                      onClick={() => setShowUserMenu(false)}
                      className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-jira-gray-100 ${
                        proj.id === currentProject?.id
                          ? "bg-jira-blue-light/50 font-semibold text-jira-blue"
                          : "text-jira-navy"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded bg-jira-gray-200 text-jira-gray-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {proj.key.slice(0, 2)}
                        </span>
                        <div className="flex flex-col leading-tight truncate">
                          <span className="truncate">{proj.name}</span>
                          <span className="text-[9px] text-jira-gray-500">{proj.key}</span>
                        </div>
                      </div>
                      {proj.id === currentProject?.id && (
                        <Check className="w-3.5 h-3.5 text-jira-blue shrink-0" />
                      )}
                    </Link>
                  ))}
                </div>
                <div className="pt-1 mt-1 border-t border-jira-gray-200 px-1">
                  <Link
                    href="/projects"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-jira-gray-700 hover:bg-jira-gray-100 hover:text-jira-navy rounded transition-colors"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 text-jira-blue" />
                    <span>View all projects</span>
                  </Link>
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

              {/* System Settings (Desktop only) */}
              {isInstanceAdmin && (
                <div className="hidden md:block py-1 border-b border-jira-gray-200">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-jira-navy hover:bg-jira-gray-100 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-jira-blue" />
                    <span>System Settings</span>
                  </Link>
                </div>
              )}

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

