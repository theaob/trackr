import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TabBar, { activeTab } from "@/components/shell/TabBar";
import KanbanBoard from "@/components/board/KanbanBoard";
import IssuesListView, { resolveNextSelectedIssueId } from "@/components/issues/IssuesListView";
import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";
import ProjectSettingsView from "@/components/settings/ProjectSettingsView";
import GeneralSettingsView from "@/components/settings/GeneralSettingsView";
import { viewport } from "@/app/layout";
import { ToastProvider } from "@/components/ui/Toast";
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
    // Pinch zoom must stay available.
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).not.toBe(false);
  });

  it("puts a tab bar along the bottom on phones, with the current page marked", () => {
    const html = renderToStaticMarkup(
      React.createElement(TabBar, { project: mockProject, unread: 3, onMore: vi.fn() })
    );

    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*md:hidden/);
    for (const label of ["Home", "Board", "Issues", "Inbox", "More"]) expect(html).toContain(label);
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/projects\/MOB\/board"/);
    expect(html).toContain("3<span class=\"sr-only\"> unread</span>");
  });

  it("offers Sign in in place of Home and Inbox when signed out", () => {
    const html = renderToStaticMarkup(
      React.createElement(TabBar, { project: mockProject, unread: 0, signedIn: false, onMore: vi.fn() })
    );

    expect(html).toContain("Sign in");
    expect(html).toContain("/login?next=%2Fprojects%2FTEST%2Fboard");
    expect(html).not.toContain(">Home<");
    expect(html).not.toContain(">Inbox<");
  });

  it("maps each page to its tab", () => {
    expect(activeTab("/home")).toBe("home");
    expect(activeTab("/inbox")).toBe("inbox");
    expect(activeTab("/projects/MOB/board")).toBe("board");
    expect(activeTab("/projects/MOB/issues/MOB-1")).toBe("issues");
    expect(activeTab("/projects/MOB/backlog")).toBeNull();
  });

  it("renders mobile column switcher tab pills and scroll-snapping board container in KanbanBoard", () => {
    const mockStatuses: WorkflowStatus[] = [
      { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", name: "IN_PROGRESS", category: "IN_PROGRESS", order: 1, projectId: "p1", color: "#0052cc", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "s3", name: "DONE", category: "DONE", order: 2, projectId: "p1", color: "#00875a", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    const html = renderToStaticMarkup(
      React.createElement(ToastProvider, null, React.createElement(KanbanBoard, {
        project: mockProject,
        initialIssues: [],
        users: [],
        sprints: [],
        statuses: mockStatuses,
        transitions: [],
      }))
    );

    // Mobile column switcher, hidden from md up
    expect(html).toMatch(/class="md:hidden flex[^"]*overflow-x-auto[^"]*"[^>]*role="group"[^>]*aria-label="Columns"/);
    // Column tab pills with titles
    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");
    // The first column's pill is the pressed one
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>To Do<\/span>/);
    // Board container snaps columns into place on phones only
    expect(html).toContain("snap-x snap-mandatory");
    expect(html).toContain("md:snap-none");
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
      React.createElement(ToastProvider, null, React.createElement(IssuesListView, {
        project: mockProject,
        initialIssues: [mockIssue],
        users: [],
        sprints: [],
        statuses: [
          { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
        ],
      }))
    );

    // List is visible on mobile (class contains "block" and does NOT have "hidden md:block")
    expect(html).toContain("MOB-1");
    expect(html).toContain("Fix mobile issues list view");
    expect(html).toMatch(/<ul aria-label="Issues" class="[^"]* block"/);
    // Detail panel has "hidden md:block" on mobile
    expect(html).toContain("min-w-0 flex-1 overflow-y-auto bg-surface hidden md:block");
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
      React.createElement(ToastProvider, null, React.createElement(IssuesListView, {
        project: mockProject,
        initialIssues: [mockIssue],
        initialSelectedIssueKey: "MOB-1",
        users: [],
        sprints: [],
        statuses: [
          { id: "s1", name: "TODO", category: "TODO", order: 0, projectId: "p1", color: "#42526e", wipLimit: null, isBacklog: false, createdAt: new Date(), updatedAt: new Date() },
        ],
      }))
    );

    // The left list is hidden on mobile: "hidden md:block"
    expect(html).toMatch(/<ul aria-label="Issues" class="[^"]* hidden md:block"/);
    // Detail panel is visible on mobile: "block"
    expect(html).toContain("min-w-0 flex-1 overflow-y-auto bg-surface block");
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
    expect(html).toContain("hidden md:inline-flex bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold");
    // Project Settings icon link is hidden on mobile: hidden md:flex
    expect(html).toContain("hidden md:flex items-center gap-1 hover:text-accent transition-colors");
  });

  it("renders mobile desktop-only notice and wraps settings layout in hidden md:block in ProjectSettingsView", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(ProjectSettingsView, {
          project: mockProject,
          users: [],
        })
      )
    );

    // Mobile notice visible on md:hidden
    expect(html).toContain("md:hidden flex-1 flex flex-col items-center justify-center");
    expect(html).toContain("Desktop Only Feature");
    expect(html).toContain("Back to Board");
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
