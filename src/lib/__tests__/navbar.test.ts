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

vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({
    currentUser: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
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
});
