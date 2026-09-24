import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canUserCreateProjects, requireCanCreateProject, AuthError } from "@/lib/auth/guards";
import { UserProvider } from "@/context/UserContext";
import { User, Project } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
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

let currentMockUser: any = null;

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => currentMockUser),
}));

vi.mock("@/components/projects/CreateProjectModal", () => ({
  default: () => null,
}));

import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";

describe("Project Creation Permission Guard", () => {
  beforeEach(() => {
    currentMockUser = null;
  });

  describe("canUserCreateProjects helper", () => {
    it("returns true only when canCreateProjects is explicitly true", () => {
      expect(canUserCreateProjects({ id: "1", name: "A", email: "a@a.com", role: "Admin", avatarUrl: null, canCreateProjects: true })).toBe(true);
      expect(canUserCreateProjects({ id: "2", name: "B", email: "b@b.com", role: "Dev", avatarUrl: null, canCreateProjects: false })).toBe(false);
      expect(canUserCreateProjects({ id: "3", name: "C", email: "c@c.com", role: "Dev", avatarUrl: null })).toBe(false);
      expect(canUserCreateProjects(null)).toBe(false);
      expect(canUserCreateProjects(undefined)).toBe(false);
    });
  });

  describe("requireCanCreateProject guard", () => {
    it("throws 401 AuthError when caller is not signed in", async () => {
      currentMockUser = null;
      await expect(requireCanCreateProject()).rejects.toThrow("You must be signed in to perform this action.");
    });

    it("throws 403 AuthError when user lacks canCreateProjects permission", async () => {
      currentMockUser = {
        id: "u1",
        name: "Standard Dev",
        email: "dev@example.com",
        role: "Developer",
        canCreateProjects: false,
      };

      try {
        await requireCanCreateProject();
        expect.unreachable("Should have thrown 403 AuthError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(AuthError);
        expect(err.message).toBe("You do not have permission to create projects.");
        expect(err.status).toBe(403);
      }
    });

    it("succeeds when user has canCreateProjects: true", async () => {
      currentMockUser = {
        id: "u2",
        name: "Admin Lead",
        email: "lead@example.com",
        role: "Tech Lead",
        canCreateProjects: true,
      };

      const user = await requireCanCreateProject();
      expect(user.id).toBe("u2");
      expect(user.canCreateProjects).toBe(true);
    });
  });
});

describe("Project Creation UI Gating", () => {
  const allowedUser: User = {
    id: "user-allowed",
    name: "Allowed User",
    email: "allowed@example.com",
    role: "Lead",
    avatarUrl: null,
    canCreateProjects: true,
  };

  const restrictedUser: User = {
    id: "user-restricted",
    name: "Restricted User",
    email: "restricted@example.com",
    role: "Developer",
    avatarUrl: null,
    canCreateProjects: false,
  };

  const mockProject: Project = {
    id: "proj-1",
    name: "Test Project",
    key: "TEST",
    description: null,
    leadId: "user-allowed",
    boardType: "SCRUM",
  };

  describe("ProjectsDirectoryView", () => {
    it("renders 'Create Project' button when user has canCreateProjects: true", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          UserProvider,
          { sessionUser: allowedUser, initialUsers: [allowedUser] },
          React.createElement(ProjectsDirectoryView, {
            initialProjects: [],
            users: [allowedUser],
          })
        )
      );

      expect(html).toContain("Create Project");
      expect(html).toContain("Try adjusting your search query or create a new project.");
    });

    it("does NOT render 'Create Project' button when user has canCreateProjects: false", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          UserProvider,
          { sessionUser: restrictedUser, initialUsers: [restrictedUser] },
          React.createElement(ProjectsDirectoryView, {
            initialProjects: [],
            users: [restrictedUser],
          })
        )
      );

      expect(html).not.toContain("Create Project");
      expect(html).toContain("contact an administrator to be added to a project");
    });

    it("does NOT render 'Create Project' button when no user is signed in", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          UserProvider,
          { sessionUser: null, initialUsers: [] },
          React.createElement(ProjectsDirectoryView, {
            initialProjects: [],
            users: [],
          })
        )
      );

      expect(html).not.toContain("Create Project");
    });
  });

  describe("createProject Server Action Enforcement", () => {
    it("rejects project creation when user lacks permission", async () => {
      currentMockUser = {
        id: "u-restricted",
        name: "Restricted",
        email: "r@example.com",
        role: "Developer",
        canCreateProjects: false,
      };

      const { createProject } = await import("@/lib/actions/projects");
      const result = await createProject({
        name: "Test New Project",
        key: "NEWPROJ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("You do not have permission to create projects.");
    });

    it("rejects project creation when user is not signed in", async () => {
      currentMockUser = null;

      const { createProject } = await import("@/lib/actions/projects");
      const result = await createProject({
        name: "Test New Project",
        key: "NEWPROJ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("You must be signed in to perform this action.");
    });
  });
});
