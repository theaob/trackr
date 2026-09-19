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
} from "lucide-react";

interface SidebarProps {
  project: Project;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ project, collapsed: propCollapsed, onToggleCollapse }: SidebarProps) {
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

  const navItems = [
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
  if (currentUser) {
    navItems.push({
      name: "Project Settings",
      href: `/projects/${project.key}/settings`,
      icon: Settings,
    });
  }

  return (
    <aside
      className={`relative bg-jira-gray-50 border-r border-jira-gray-300 transition-all duration-200 ease-in-out select-none flex flex-col shrink-0 ${
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
            <Link
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
  );
}
