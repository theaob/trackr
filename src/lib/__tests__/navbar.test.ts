import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Navbar from "@/components/layout/Navbar";
import { Project } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/TEST/board",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

let mockCurrentUser: { id: string; name: string; email: string; role: string } | null = {
  id: "u1",
  name: "Test User",
  email: "test@example.com",
  role: "ADMIN",
};

vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({
    get currentUser() {
      return mockCurrentUser;
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

describe("Navbar Project Selector", () => {
  const mockProject: Project = {
    id: "p1",
    name: "Apollo Cloud Engine",
    key: "APOLLO",
    boardType: "SCRUM",
    description: null,
    leadId: null,
  };

  it("renders the selected project name and subtle project key underneath", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    expect(html).toContain("Apollo Cloud Engine");
    expect(html).toContain("APOLLO");
  });

  it("renders 'Select Project' when no project is currently selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: null,
      })
    );

    expect(html).toContain("Select Project");
  });

  it("renders the notification button when a user is logged in", () => {
    mockCurrentUser = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    };
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    expect(html).toContain('title="Notifications"');
  });

  it("does not render the notification button when no user is logged in", () => {
    mockCurrentUser = null;
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    expect(html).not.toContain('title="Notifications"');
  });

  it("renders mobile project selector under the right bar and desktop project selector on the left", () => {
    mockCurrentUser = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    };
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        projects: [mockProject],
        currentProject: mockProject,
      })
    );

    // Desktop project selector is hidden on mobile screens
    expect(html).toContain("hidden md:block relative min-w-0");
    // Mobile project selector is rendered in the right bar with md:hidden
    expect(html).toContain('aria-label="Select Project"');
    expect(html).toContain("md:hidden relative");
  });
});
