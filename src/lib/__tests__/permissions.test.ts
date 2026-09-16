import { describe, expect, it } from "vitest";
import { hasPermission, resolveUserProjectRole } from "@/lib/permissions";

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
