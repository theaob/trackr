import { describe, expect, it } from "vitest";
import {
  hasPermission,
  resolveUserProjectRole,
  canManageProject,
  canManageAccess,
  canManageSprints,
  canManageVersions,
  canCreateIssue,
  canEditIssue,
  canDeleteIssue,
  canMoveIssue,
  canAddComment,
} from "@/lib/permissions";

describe("hasPermission", () => {
  it("grants administrators every permission", () => {
    expect(hasPermission("ADMIN", "MANAGE_ACCESS")).toBe(true);
    expect(hasPermission("ADMIN", "DELETE_ISSUE")).toBe(true);
  });

  it("withholds administration from members", () => {
    expect(hasPermission("MEMBER", "CREATE_ISSUE")).toBe(true);
    expect(hasPermission("MEMBER", "PROJECT_ADMIN")).toBe(false);
    expect(hasPermission("MEMBER", "MANAGE_ACCESS")).toBe(false);
  });

  it("gives viewers read access only", () => {
    expect(hasPermission("VIEWER", "VIEW_PROJECT")).toBe(true);
    for (const permission of ["CREATE_ISSUE", "EDIT_ISSUE", "MOVE_ISSUE", "ADD_COMMENT"] as const) {
      expect(hasPermission("VIEWER", permission)).toBe(false);
    }
  });

  it("grants nothing without a role", () => {
    expect(hasPermission(null, "VIEW_PROJECT")).toBe(false);
    expect(hasPermission(undefined, "VIEW_PROJECT")).toBe(false);
  });
});

describe("resolveUserProjectRole", () => {
  const project = { leadId: "lead-1", members: [{ userId: "u2", role: "VIEWER" }] };

  it("treats the project lead as an administrator", () => {
    expect(resolveUserProjectRole("lead-1", project)).toBe("ADMIN");
  });

  it("uses the explicit membership role", () => {
    expect(resolveUserProjectRole("u2", project)).toBe("VIEWER");
  });

  // The permissive fallback here let a non-member act as a MEMBER on any
  // project whose membership list happened to be empty.
  it("returns null for a non-member, including when there are no members", () => {
    expect(resolveUserProjectRole("stranger", project)).toBeNull();
    expect(resolveUserProjectRole("stranger", { leadId: null, members: [] })).toBeNull();
  });

  it("returns null without a user", () => {
    expect(resolveUserProjectRole(null, project)).toBeNull();
    expect(resolveUserProjectRole(undefined, project)).toBeNull();
  });
});

describe("resolveUserProjectRole on a project published to anonymous viewers", () => {
  const published = {
    leadId: "lead-1",
    allowAnonymousViewers: true,
    members: [
      { userId: "member-1", role: "MEMBER" },
      { userId: "admin-1", role: "ADMIN" },
    ],
  };

  it("gives a visitor with no session read-only access", () => {
    expect(resolveUserProjectRole(null, published)).toBe("VIEWER");
    expect(resolveUserProjectRole(undefined, published)).toBe("VIEWER");
  });

  it("gives a signed-in non-member the same read-only access", () => {
    expect(resolveUserProjectRole("stranger", published)).toBe("VIEWER");
  });

  it("does not downgrade members or the lead", () => {
    expect(resolveUserProjectRole("lead-1", published)).toBe("ADMIN");
    expect(resolveUserProjectRole("admin-1", published)).toBe("ADMIN");
    expect(resolveUserProjectRole("member-1", published)).toBe("MEMBER");
  });

  // The whole safety argument rests on VIEWER holding nothing but reads, so
  // publishing a project can never hand out a write.
  it("grants a visitor reads and nothing else", () => {
    const role = resolveUserProjectRole(null, published);
    expect(hasPermission(role, "VIEW_PROJECT")).toBe(true);
    for (const permission of [
      "CREATE_ISSUE",
      "EDIT_ISSUE",
      "DELETE_ISSUE",
      "MOVE_ISSUE",
      "ADD_COMMENT",
      "MANAGE_SPRINTS",
      "MANAGE_VERSIONS",
      "MANAGE_ACCESS",
      "PROJECT_ADMIN",
    ] as const) {
      expect(hasPermission(role, permission)).toBe(false);
    }
  });

  it("keeps an unpublished project closed to visitors", () => {
    const priv = { leadId: "lead-1", allowAnonymousViewers: false, members: [] };
    expect(resolveUserProjectRole(null, priv)).toBeNull();
    expect(resolveUserProjectRole("stranger", priv)).toBeNull();
    // An absent flag behaves like false.
    expect(resolveUserProjectRole(null, { leadId: "lead-1", members: [] })).toBeNull();
  });
});

describe("permission helper functions", () => {
  it("checks admin capabilities accurately", () => {
    expect(canManageProject("ADMIN")).toBe(true);
    expect(canManageAccess("ADMIN")).toBe(true);
    expect(canManageSprints("ADMIN")).toBe(true);
    expect(canManageVersions("ADMIN")).toBe(true);
    expect(canCreateIssue("ADMIN")).toBe(true);
    expect(canEditIssue("ADMIN")).toBe(true);
    expect(canDeleteIssue("ADMIN")).toBe(true);
    expect(canMoveIssue("ADMIN")).toBe(true);
    expect(canAddComment("ADMIN")).toBe(true);
  });

  it("checks member capabilities accurately", () => {
    expect(canManageProject("MEMBER")).toBe(false);
    expect(canManageAccess("MEMBER")).toBe(false);
    expect(canManageSprints("MEMBER")).toBe(true);
    expect(canManageVersions("MEMBER")).toBe(true);
    expect(canCreateIssue("MEMBER")).toBe(true);
    expect(canEditIssue("MEMBER")).toBe(true);
    expect(canDeleteIssue("MEMBER")).toBe(true);
    expect(canMoveIssue("MEMBER")).toBe(true);
    expect(canAddComment("MEMBER")).toBe(true);
  });

  it("withholds write actions from viewers", () => {
    expect(canManageProject("VIEWER")).toBe(false);
    expect(canManageAccess("VIEWER")).toBe(false);
    expect(canManageSprints("VIEWER")).toBe(false);
    expect(canManageVersions("VIEWER")).toBe(false);
    expect(canCreateIssue("VIEWER")).toBe(false);
    expect(canEditIssue("VIEWER")).toBe(false);
    expect(canDeleteIssue("VIEWER")).toBe(false);
    expect(canMoveIssue("VIEWER")).toBe(false);
    expect(canAddComment("VIEWER")).toBe(false);
  });
});
