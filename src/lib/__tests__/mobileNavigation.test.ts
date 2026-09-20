import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import KanbanBoard from "@/components/board/KanbanBoard";
import IssuesListView, { resolveNextSelectedIssueId } from "@/components/issues/IssuesListView";
import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";
import ProjectSettingsView from "@/components/settings/ProjectSettingsView";
import GeneralSettingsView from "@/components/settings/GeneralSettingsView";
import { viewport } from "@/app/layout";
import { Project, WorkflowStatus, Issue } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/TEST/board",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/actions/issues", () => ({
  updateIssueStatusAndOrder: vi.fn(),
  getIssueByKeyOrId: vi.fn().mockResolvedValue(null),
  getPaginatedIssues: vi.fn().mockResolvedValue({ issues: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 1 }),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
  bulkUpdateIssues: vi.fn(),
  bulkDeleteIssues: vi.fn(),
}));

vi.mock("@/lib/actions/labels", () => ({
  bulkAddLabel: vi.fn(),
}));

vi.mock("@/lib/actions/comments", () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/lib/actions/attachments", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  MAX_ATTACHMENT_SIZE: 10485760,
  formatFileSize: vi.fn(),
  generatePastedImageFileName: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/actions/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/lib/actions/tokens", () => ({
  getUserTokens: vi.fn().mockResolvedValue([]),
  createPersonalAccessToken: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));

vi.mock("@/lib/actions/notifications", () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/actions/projects", () => ({
  getProjects: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn(),
}));

vi.mock("@/lib/actions/customFields", () => ({
  deleteCustomField: vi.fn(),
}));

vi.mock("@/lib/actions/components", () => ({
  deleteComponent: vi.fn(),
}));

vi.mock("@/lib/actions/webhooks", () => ({
  deleteWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  testWebhook: vi.fn(),
}));

vi.mock("@/lib/actions/system", () => ({
  getSystemInfo: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({
    currentUser: {
      id: "u1",
      name: "Mobile User",
      email: "mobile@example.com",
      role: "ADMIN",
      canCreateProjects: true,
    },
    users: [],
    setCurrentUser: vi.fn(),
    setUsers: vi.fn(),
  }),
}));

vi.mock("@/context/SearchContext", () => ({
  useSearch: () => ({
    searchQuery: "",
    setSearchQuery: vi.fn(),
  }),
}));

vi.mock("@/context/KeyboardShortcutsContext", () => ({
  useKeyboardShortcutsContext: () => ({
    openShortcutsModal: vi.fn(),
  }),
}));

vi.mock("@/hooks/useProjectPermissions", () => ({
  useProjectPermissions: () => ({
    isViewer: false,
    roleConfig: {
      name: "Admin",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-800",
      border: "border-blue-200",
    },
  }),
}));

vi.mock("@/lib/permissions", () => ({
  resolveUserProjectRole: () => "ADMIN",
}));

describe("Mobile Viewport & Navigation", () => {
  const mockProject: Project = {
    id: "p1",
    name: "Mobile App Project",
    key: "MOB",
    boardType: "SCRUM",
    description: "Mobile responsiveness testing",
    leadId: null,
  };

  it("exports correct Next.js 14 viewport configuration for mobile responsiveness", () => {
    expect(viewport).toBeDefined();
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.viewportFit).toBe("cover");
  });

  it("renders mobile menu hamburger button in Navbar when toggle handler is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
        onToggleMobileMenu: vi.fn(),
      })
    );

    expect(html).toContain("Open navigation menu");
    expect(html).toContain("md:hidden");
  });

  it("renders mobile search trigger button in Navbar", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    expect(html).toContain("Search issues");
  });

  it("renders desktop sidebar with hidden md:flex layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        project: mockProject,
        isMobileOpen: false,
        onCloseMobile: vi.fn(),
      })
    );

    expect(html).toContain("hidden md:flex");
    expect(html).not.toContain("md:hidden fixed inset-0 z-50 flex");
  });

  it("does not render project change button on top bar on mobile", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    // Desktop project selector is hidden on mobile screens
    expect(html).toContain("hidden md:block relative min-w-0");
    // No mobile project change button rendered on the top bar
    expect(html).not.toContain('aria-label="Select Project"');
  });

  it("renders mobile slide-over drawer and backdrop when isMobileOpen is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        project: mockProject,
        isMobileOpen: true,
        onCloseMobile: vi.fn(),
      })
    );

    // Mobile slide-over container and backdrop
    expect(html).toContain("md:hidden fixed inset-0 z-50 flex");
    expect(html).toContain("bg-black/50");
    expect(html).toContain("Close navigation");
    expect(html).toContain("Active Board");
    expect(html).toContain("Backlog");
    expect(html).toContain("Switch Project");
  });

  it("renders mobile column switcher tab pills and scroll-snapping board container in KanbanBoard", () => {
    const mockStatuses: WorkflowStatus[] = [
      { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", name: "IN_PROGRESS", category: "IN_PROGRESS", order: 1, projectId: "p1", color: "#0052cc", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "s3", name: "DONE", category: "DONE", order: 2, projectId: "p1", color: "#00875a", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    const html = renderToStaticMarkup(
      React.createElement(KanbanBoard, {
        project: mockProject,
        initialIssues: [],
        users: [],
        sprints: [],
        statuses: mockStatuses,
        transitions: [],
      })
    );

    // Mobile tabs wrapper
    expect(html).toContain("md:hidden flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar");
    // Column tab pills with titles
    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");
    // Active pill styling
    expect(html).toContain("bg-jira-blue text-white shadow-xs");
    // Board container with scroll-snapping and relative positioning
    expect(html).toContain("snap-x snap-mandatory scroll-smooth relative");
    // Column snap-center styling
    expect(html).toContain("snap-center");
  });

  it("renders issues list on mobile by default when no issue is selected", () => {
    const mockIssue: Issue = {
      id: "i1",
      key: "MOB-1",
      title: "Fix mobile issues list view",
      description: "Ensure issues list is visible on mobile",
      type: "BUG",
      status: "TODO",
      priority: "HIGH",
      projectId: "p1",
      reporterId: "u1",
      assigneeId: null,
      sprintId: null,
      versionId: null,
      parentId: null,
      storyPoints: 3,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: null,
      startDate: null,
      originalEstimateSeconds: null,
      remainingEstimateSeconds: null,
      components: [],
      labels: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(IssuesListView, {
        project: mockProject,
        initialIssues: [mockIssue],
        users: [],
        sprints: [],
        statuses: [
          { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
        ],
      })
    );

    // List is visible on mobile (class contains "block" and does NOT have "hidden md:block")
    expect(html).toContain("MOB-1");
    expect(html).toContain("Fix mobile issues list view");
    expect(html).toContain("border-r border-jira-gray-300 overflow-y-auto divide-y divide-jira-gray-200 shrink-0 bg-white block");
    // Detail panel has "hidden md:block" on mobile
    expect(html).toContain("flex-1 min-w-0 overflow-y-auto bg-white p-3.5 sm:p-6 hidden md:block");
  });

  it("renders detail panel on mobile when an issue is explicitly selected", () => {
    const mockIssue: Issue = {
      id: "i1",
      key: "MOB-1",
      title: "Fix mobile issues list view",
      description: "Ensure issues list is visible on mobile",
      type: "BUG",
      status: "TODO",
      priority: "HIGH",
      projectId: "p1",
      reporterId: "u1",
      assigneeId: null,
      sprintId: null,
      versionId: null,
      parentId: null,
      storyPoints: 3,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: null,
      startDate: null,
      originalEstimateSeconds: null,
      remainingEstimateSeconds: null,
      components: [],
      labels: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(IssuesListView, {
        project: mockProject,
        initialIssues: [mockIssue],
        initialSelectedIssueKey: "MOB-1",
        users: [],
        sprints: [],
        statuses: [
          { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
        ],
      })
    );

    // The left list is hidden on mobile: "hidden md:block"
    expect(html).toContain("border-r border-jira-gray-300 overflow-y-auto divide-y divide-jira-gray-200 shrink-0 bg-white hidden md:block");
    // Detail panel is visible on mobile: "block"
    expect(html).toContain("flex-1 min-w-0 overflow-y-auto bg-white p-3.5 sm:p-6 block");
    // Back to issues list button is present
    expect(html).toContain("Back to issues list");
  });

  describe("Mobile issues list selection resolution", () => {
    it("preserves unselected state (null) when issues are loaded without selection", () => {
      // Prevents automatically opening the first issue on mobile when visiting issues list
      const issues = [{ id: "i1" }, { id: "i2" }, { id: "i3" }];
      expect(resolveNextSelectedIssueId(null, issues)).toBeNull();
    });

    it("returns null when issues list is empty", () => {
      expect(resolveNextSelectedIssueId(null, [])).toBeNull();
      expect(resolveNextSelectedIssueId("i1", [])).toBeNull();
    });

    it("preserves selected issue id when it remains in the updated issues list", () => {
      const issues = [{ id: "i1" }, { id: "i2" }, { id: "i3" }];
      expect(resolveNextSelectedIssueId("i2", issues)).toBe("i2");
    });

    it("clears selection to null (returning mobile to list) when selected issue is filtered out or deleted", () => {
      const issues = [{ id: "i1" }, { id: "i3" }];
      expect(resolveNextSelectedIssueId("i2", issues)).toBeNull();
    });
  });

  it("hides administrative Project Settings from mobile navigation drawer while keeping it on desktop", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        project: mockProject,
        isMobileOpen: true,
        onCloseMobile: vi.fn(),
      })
    );

    // Mobile slide-over drawer section (<aside comes after drawer in DOM) should NOT contain Project Settings
    const asideIndex = html.indexOf("<aside");
    const mobileDrawerHtml = html.slice(0, asideIndex);
    expect(mobileDrawerHtml).not.toContain("Project Settings");
    expect(mobileDrawerHtml).toContain("Active Board");
    expect(mobileDrawerHtml).toContain("Backlog");

    // Desktop sidebar section DOES contain Project Settings
    const desktopSidebarHtml = html.slice(asideIndex);
    expect(desktopSidebarHtml).toContain("Project Settings");
  });

  it("hides System Settings on mobile in Navbar user dropdown", () => {
    const navbarSource = fs.readFileSync(
      path.resolve(__dirname, "../../components/layout/Navbar.tsx"),
      "utf-8"
    );

    // System Settings link container has hidden md:block
    expect(navbarSource).toContain("hidden md:block py-1 border-b border-jira-gray-200");
    expect(navbarSource).toContain("System Settings");
  });

  it("hides administrative Create Project and Project Settings on mobile in ProjectsDirectoryView", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectsDirectoryView, {
        initialProjects: [
          {
            ...mockProject,
            lead: null,
            totalIssues: 5,
            openIssues: 2,
          },
        ],
        users: [],
      })
    );

    // Create Project button is hidden on mobile: hidden md:inline-flex
    expect(html).toContain("hidden md:inline-flex bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold");
    // Project Settings icon link is hidden on mobile: hidden md:flex
    expect(html).toContain("hidden md:flex items-center gap-1 hover:text-jira-blue transition-colors");
  });

  it("renders mobile desktop-only notice and wraps settings layout in hidden md:block in ProjectSettingsView", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectSettingsView, {
        project: mockProject,
        users: [],
      })
    );

    // Mobile notice visible on md:hidden
    expect(html).toContain("md:hidden flex-1 flex flex-col items-center justify-center");
    expect(html).toContain("Desktop Only Feature");
    expect(html).toContain("Back to Active Board");
    expect(html).toContain("Back to Issues");

    // Desktop settings layout wrapped in hidden md:block
    expect(html).toContain("hidden md:block space-y-6");
  });

  it("renders mobile desktop-only notice and wraps settings layout in hidden md:block in GeneralSettingsView", () => {
    const html = renderToStaticMarkup(
      React.createElement(GeneralSettingsView, {
        initialSystemInfo: null,
      })
    );

    // Mobile notice visible on md:hidden
    expect(html).toContain("md:hidden flex flex-col items-center justify-center");
    expect(html).toContain("Desktop Only Feature");
    expect(html).toContain("Back to Projects");

    // Desktop settings layout wrapped in hidden md:block
    expect(html).toContain("hidden md:block space-y-6");
  });
});
