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
  ShieldCheck,
  Shield,
  Camera,
  Trash2,
  Loader2,
  LogOut,
  LogIn,
  Settings,
  Sparkles,
} from "lucide-react";
import PersonalAccessTokensModal from "@/components/auth/PersonalAccessTokensModal";
import AccountSecurityModal from "@/components/auth/AccountSecurityModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";
import UserAvatar from "@/components/common/UserAvatar";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { resolveUserProjectRole } from "@/lib/permissions";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import { filterablePage } from "@/lib/spotlight";
import { FILTER_PAGE_EVENT } from "@/components/common/SpotlightSearch";

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
  const { currentUser } = useCurrentUser();
  const { avatarUploading, uploadAvatar, deleteAvatar, signingOut, signOut, switchingLayout, switchLayout } =
    useAccountActions();
  const permissions = useProjectPermissions(currentProject);
  const { searchQuery, setSearchQuery } = useSearch();
  const { openShortcutsModal, openSpotlight } = useKeyboardShortcutsContext();
  const modKey = useModKeyLabel();
  const searchShortcut = modKey === "⌘" ? "⌘K" : `${modKey} K`;
  // Only the board, backlog and issue list read the filter box.
  const canFilterPage = filterablePage(pathname) !== null;

  const accessibleProjects = useMemo(
    () => projects.filter((proj) => resolveUserProjectRole(currentUser?.id, proj) !== null),
    [projects, currentUser]
  );

  const isInstanceAdmin = !!currentUser?.isInstanceAdmin;

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // "Filter … for" in the ⌘K panel fills in the filter box.
  useEffect(() => {
    const applyFilter = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query ?? "";
      setSearchQuery(query);
      // On a phone the filter box is hidden until opened; show what's filtering.
      if (window.matchMedia("(max-width: 767px)").matches) setIsMobileSearchOpen(true);
    };
    window.addEventListener(FILTER_PAGE_EVENT, applyFilter);
    return () => window.removeEventListener(FILTER_PAGE_EVENT, applyFilter);
  }, [setSearchQuery]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAvatar(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  return (
    <header className="h-14 border-b border-subtle bg-white px-3 sm:px-4 flex items-center justify-between select-none z-30 relative shadow-sm">
      {/* Full-width Mobile Search Bar Overlay */}
      {isMobileSearchOpen && (
        <div className="md:hidden absolute inset-0 bg-white z-50 px-3 flex items-center gap-2 border-b border-subtle animate-in fade-in slide-in-from-top-1">
          <Search className="w-4 h-4 text-accent shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search issues, keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 py-1.5 text-sm text-ink bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 text-muted hover:text-ink-2 transition-colors"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="text-xs font-semibold text-accent hover:text-accent-hover px-2 py-1 transition-colors"
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
            className="md:hidden p-1.5 -ml-1 text-ink-2 hover:text-ink hover:bg-surface-sunk rounded-md transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link prefetch={false}
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
            className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1 rounded text-ink hover:bg-surface-sunk transition-colors text-left max-w-[130px] sm:max-w-none truncate"
          >
            <FolderGit2 className="w-4 h-4 text-accent shrink-0" />
            <div className="flex flex-col leading-none text-left min-w-0 truncate">
              <span className="text-xs sm:text-sm font-medium truncate max-w-[90px] sm:max-w-[240px]">
                {currentProject ? currentProject.name : "Select Project"}
              </span>
              {currentProject && (
                <span className="text-[10px] font-medium text-muted tracking-wider mt-0.5">
                  {currentProject.key}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-2 shrink-0" />
          </button>

          {showProjectMenu && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-subtle rounded-md shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-2 text-[11px] font-semibold text-ink-2 uppercase tracking-wider border-b border-subtle">
                Recent Projects
              </div>
              {accessibleProjects.map((proj) => (
                <Link prefetch={false}
                  key={proj.id}
                  href={`/projects/${proj.key}/board`}
                  onClick={() => setShowProjectMenu(false)}
                  className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-sunk ${
                    proj.id === currentProject?.id ? "bg-accent-soft/50 font-semibold text-accent" : "text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-6 h-6 rounded bg-subtle text-ink text-[10px] font-bold flex items-center justify-center shrink-0">
                      {proj.key.slice(0, 2)}
                    </span>
                    <div className="flex flex-col leading-tight truncate">
                      <span className="truncate">{proj.name}</span>
                      <span className="text-[10px] font-medium text-muted tracking-wider">{proj.key}</span>
                    </div>
                  </div>
                  {proj.id === currentProject?.id && <Check className="w-4 h-4 text-accent shrink-0" />}
                </Link>
              ))}

              <div className="pt-1 mt-1 border-t border-subtle">
                <Link prefetch={false}
                  href="/projects"
                  onClick={() => setShowProjectMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-sunk hover:text-ink transition-colors"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-accent" />
                  <span>View all projects</span>
                </Link>
                {currentUser?.canCreateProjects && onCreateProjectClick && (
                  <button
                    onClick={() => {
                      setShowProjectMenu(false);
                      onCreateProjectClick();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-accent hover:bg-surface-sunk transition-colors"
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
                ? "bg-subtle text-muted cursor-not-allowed opacity-60"
                : "bg-accent hover:bg-accent-hover text-accent-fg"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>
        )}
      </div>

      {/* Right side: Search & User Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

        {/* Mobile: search issues, pages and projects */}
        <button
          type="button"
          onClick={openSpotlight}
          className="md:hidden p-2 text-ink-2 hover:text-ink hover:bg-surface-sunk rounded-full transition-colors"
          aria-label="Search issues, pages and projects"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Desktop: the page filter where there's something to filter, and search everywhere */}
        {canFilterPage && (
          <div className="hidden md:block relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              aria-label="Filter issues on this page"
              placeholder="Filter issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-surface-sunk hover:bg-subtle focus:bg-white border border-transparent focus:border-accent rounded transition-all text-ink"
            />
            {!searchQuery && (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-muted bg-subtle/60 border border-subtle rounded px-1.5 py-0.5 pointer-events-none">
                /
              </kbd>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={openSpotlight}
          title={`Search issues, pages and projects (${searchShortcut})`}
          aria-label="Search issues, pages and projects"
          aria-keyshortcuts="Meta+K Control+K"
          className={`hidden md:flex items-center gap-2 h-8 rounded text-sm text-muted bg-surface-sunk hover:bg-subtle hover:text-ink border border-transparent transition-colors ${
            canFilterPage ? "px-2.5" : "w-64 pl-3 pr-2"
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          {!canFilterPage && <span className="flex-1 text-left truncate">Search Trackr...</span>}
          <kbd className="text-xs font-sans font-semibold text-muted bg-white/70 border border-subtle rounded px-1.5 leading-5 whitespace-nowrap">
            {searchShortcut}
          </kbd>
        </button>

        {/* Help & Notification icons */}
        <button
          onClick={openShortcutsModal}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="hidden sm:flex p-2 text-ink-2 hover:text-ink hover:bg-surface-sunk rounded-full transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {currentUser && <NotificationsMenu />}

        {/* Current User Switcher */}
        <div className="relative">
          {!currentUser ? (
            // Anonymous visitor on a project published for read-only access.
            <Link prefetch={false}
              href={`/login?next=${encodeURIComponent(pathname || "/projects")}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold text-accent-fg bg-accent hover:bg-accent-hover transition-colors"
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
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full hover:bg-surface-sunk transition-colors border border-transparent hover:border-subtle"
          >
            <UserAvatar user={currentUser} size="md" className="border border-subtle" />
            <span className="text-xs font-medium text-ink hidden sm:inline max-w-[100px] truncate">
              {currentUser?.name}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-px rounded border hidden md:inline ${permissions.roleConfig.badgeBg} ${permissions.roleConfig.badgeText} ${permissions.roleConfig.border}`}
            >
              {permissions.roleConfig.name}
            </span>
            <ChevronDown className="w-3 h-3 text-ink-2" />
          </button>
          )}

          {currentUser && showUserMenu && (
            <div ref={userMenuRef} className="absolute right-0 top-full mt-1 w-72 bg-white border border-subtle rounded-md shadow-xl py-1 z-50 animate-in fade-in">
              <div className="px-3 py-2 border-b border-subtle">
                <p className="text-xs font-bold text-ink">{currentUser?.name}</p>
                <p className="text-[11px] text-ink-2">{currentUser?.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] bg-surface-sunk text-ink-2 font-semibold px-2 py-0.5 rounded">
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
              <div className="md:hidden py-1 border-b border-subtle">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-ink-2 uppercase tracking-wider flex items-center justify-between">
                  <span>Switch Project</span>
                  {currentProject && (
                    <span className="text-[10px] font-bold text-accent">
                      {currentProject.key}
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {accessibleProjects.map((proj) => (
                    <Link prefetch={false}
                      key={proj.id}
                      href={`/projects/${proj.key}/board`}
                      onClick={() => setShowUserMenu(false)}
                      className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-sunk ${
                        proj.id === currentProject?.id
                          ? "bg-accent-soft/50 font-semibold text-accent"
                          : "text-ink"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded bg-subtle text-ink text-[9px] font-bold flex items-center justify-center shrink-0">
                          {proj.key.slice(0, 2)}
                        </span>
                        <div className="flex flex-col leading-tight truncate">
                          <span className="truncate">{proj.name}</span>
                          <span className="text-[9px] text-muted">{proj.key}</span>
                        </div>
                      </div>
                      {proj.id === currentProject?.id && (
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                      )}
                    </Link>
                  ))}
                </div>
                <div className="pt-1 mt-1 border-t border-subtle px-1">
                  <Link prefetch={false}
                    href="/projects"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-sunk hover:text-ink rounded transition-colors"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 text-accent" />
                    <span>View all projects</span>
                  </Link>
                </div>
              </div>

              {/* Avatar Management */}
              <div className="py-1 border-b border-subtle">
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
                    className="flex-1 flex items-center gap-2.5 px-1 py-2 text-xs font-medium text-ink hover:bg-surface-sunk transition-colors rounded disabled:opacity-50"
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-accent" />
                    )}
                    <span>{currentUser?.avatarUrl ? "Change Avatar" : "Upload Avatar"}</span>
                  </button>
                  {currentUser?.avatarUrl && (
                    <button
                      onClick={deleteAvatar}
                      disabled={avatarUploading}
                      className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove avatar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Access Tokens */}
              <div className="py-1 border-b border-subtle">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowTokensModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunk transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-accent" />
                  <span>Personal Access Tokens</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowSecurityModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunk transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>Password &amp; sessions</span>
                </button>
              </div>

              {/* System Settings (Desktop only) */}
              {isInstanceAdmin && (
                <div className="hidden md:block py-1 border-b border-subtle">
                  <Link prefetch={false}
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunk transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-accent" />
                    <span>System Settings</span>
                  </Link>
                </div>
              )}

              <div className="py-1 border-b border-subtle">
                <button
                  onClick={() => switchLayout(true)}
                  disabled={switchingLayout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-sunk transition-colors disabled:opacity-50"
                >
                  {switchingLayout ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                  )}
                  <span>Try the new layout</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={signOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-sunk transition-colors disabled:opacity-50"
                >
                  {signingOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5 text-ink-2" />
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
      <AccountSecurityModal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} />

    </header>
  );
}

