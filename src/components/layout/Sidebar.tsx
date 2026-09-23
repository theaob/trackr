"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Project } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import {
  Kanban,
  ListTodo,
  Settings,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Rocket,
  BarChart3,
  Map,
  X,
  FolderGit2,
} from "lucide-react";
import { TrackrLogo } from "@/components/common/TrackrLogo";

interface SidebarProps {
  project: Project;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  project,
  collapsed: propCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = propCollapsed !== undefined;
  const collapsed = isControlled ? propCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const navItems: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    isAdministrative?: boolean;
  }> = [
    {
      name: "Active Board",
      href: `/projects/${project.key}/board`,
      icon: Kanban,
    },
    {
      name: "Backlog",
      href: `/projects/${project.key}/backlog`,
      icon: ListTodo,
    },
    {
      name: "Roadmap",
      href: `/projects/${project.key}/roadmap`,
      icon: Map,
    },
    {
      name: "Issues",
      href: `/projects/${project.key}/issues`,
      icon: ListFilter,
    },
    {
      name: "Reports",
      href: `/projects/${project.key}/reports`,
      icon: BarChart3,
    },
    {
      name: "Releases",
      href: `/projects/${project.key}/releases`,
      icon: Rocket,
    },
  ];

  // Settings needs a session, so linking a visitor there is a dead end.
  // Marked as administrative so it is hidden from mobile navigation drawers.
  if (currentUser) {
    navItems.push({
      name: "Project Settings",
      href: `/projects/${project.key}/settings`,
      icon: Settings,
      isAdministrative: true,
    });
  }

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative w-72 max-w-[80vw] bg-jira-gray-50 border-r border-jira-gray-300 flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="h-14 px-4 border-b border-jira-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <TrackrLogo size="sm" />
                <span className="text-xs font-bold text-jira-gray-500 uppercase tracking-wider">
                  {project.key}
                </span>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-100 rounded-md transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              <div className="px-3 pb-2 text-[10px] font-bold text-jira-gray-600 uppercase tracking-wider">
                Planning
              </div>
              {navItems
                .filter((item) => !item.isAdministrative)
                .map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link prefetch={false}
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-jira-blue-light/70 text-jira-blue font-semibold"
                        : "text-jira-gray-800 hover:bg-jira-gray-200 hover:text-jira-navy"
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-jira-blue" : "text-jira-gray-700"}`} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
              <div className="pt-2 mt-2 border-t border-jira-gray-200">
                <Link prefetch={false}
                  href="/projects"
                  onClick={onCloseMobile}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-jira-gray-700 hover:bg-jira-gray-200 hover:text-jira-navy transition-colors"
                >
                  <FolderGit2 className="w-4.5 h-4.5 text-jira-blue shrink-0" />
                  <span>Switch Project</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex relative bg-jira-gray-50 border-r border-jira-gray-300 transition-all duration-200 ease-in-out select-none flex-col shrink-0 ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        {/* Navigation Links */}
        <div className="flex-1 py-4 px-2 space-y-1">
          {!collapsed && (
            <div className="px-3 pb-2 text-[10px] font-bold text-jira-gray-600 uppercase tracking-wider">
              Planning
            </div>
          )}
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link prefetch={false}
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-jira-blue-light/70 text-jira-blue font-semibold"
                    : "text-jira-gray-800 hover:bg-jira-gray-200 hover:text-jira-navy"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-jira-blue" : "text-jira-gray-700"}`} />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>

        {/* Collapse Toggle Handle */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-jira-gray-300 rounded-full flex items-center justify-center text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 shadow-sm transition-all z-20"
          title={collapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  );
}
