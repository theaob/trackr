import { describe, expect, it } from "vitest";
import { ProjectRole } from "@/types";
import { hasPermission } from "@/lib/permissions";

describe("Access Control Policy: Issue Deletion Ownership", () => {
  function canUserDeleteIssue(params: {
    userRole: ProjectRole;
    userId: string;
    issueReporterId: string;
  }): boolean {
    const hasDeletePermission = hasPermission(params.userRole, "DELETE_ISSUE");
    if (!hasDeletePermission) return false;

    // Administrators can delete any issue; members can only delete issues they reported
    if (params.userRole === "ADMIN") return true;
    return params.userId === params.issueReporterId;
  }

  it("permits Project Administrators to delete any issue", () => {
    expect(
      canUserDeleteIssue({
        userRole: "ADMIN",
        userId: "admin-1",
        issueReporterId: "other-user",
      })
    ).toBe(true);

    expect(
      canUserDeleteIssue({
        userRole: "ADMIN",
        userId: "admin-1",
        issueReporterId: "admin-1",
      })
    ).toBe(true);
  });

  it("permits Members to delete their own reported issues", () => {
    expect(
      canUserDeleteIssue({
        userRole: "MEMBER",
        userId: "member-1",
        issueReporterId: "member-1",
      })
    ).toBe(true);
  });

  it("forbids Members from deleting issues reported by other users", () => {
    expect(
      canUserDeleteIssue({
        userRole: "MEMBER",
        userId: "member-1",
        issueReporterId: "lead-1",
      })
    ).toBe(false);

    expect(
      canUserDeleteIssue({
        userRole: "MEMBER",
        userId: "member-1",
        issueReporterId: "member-2",
      })
    ).toBe(false);
  });

  it("forbids Viewers from deleting any issue", () => {
    expect(
      canUserDeleteIssue({
        userRole: "VIEWER",
        userId: "viewer-1",
        issueReporterId: "viewer-1",
      })
    ).toBe(false);

    expect(
      canUserDeleteIssue({
        userRole: "VIEWER",
        userId: "viewer-1",
        issueReporterId: "someone-else",
      })
    ).toBe(false);
  });
});

describe("Access Control Policy: Releases Management", () => {
  it("allows only roles with MANAGE_VERSIONS to create, release, and edit versions", () => {
    expect(hasPermission("ADMIN", "MANAGE_VERSIONS")).toBe(true);
    expect(hasPermission("MEMBER", "MANAGE_VERSIONS")).toBe(true);
    expect(hasPermission("VIEWER", "MANAGE_VERSIONS")).toBe(false);
  });

  it("allows all roles with VIEW_PROJECT to inspect releases and release notes", () => {
    expect(hasPermission("ADMIN", "VIEW_PROJECT")).toBe(true);
    expect(hasPermission("MEMBER", "VIEW_PROJECT")).toBe(true);
    expect(hasPermission("VIEWER", "VIEW_PROJECT")).toBe(true);
  });
});

describe("Access Control Policy: Backlog & Board Drag Actions", () => {
  it("allows only roles with MOVE_ISSUE to drag cards across columns and sprints", () => {
    expect(hasPermission("ADMIN", "MOVE_ISSUE")).toBe(true);
    expect(hasPermission("MEMBER", "MOVE_ISSUE")).toBe(true);
    expect(hasPermission("VIEWER", "MOVE_ISSUE")).toBe(false);
  });

  it("allows only roles with CREATE_ISSUE to use inline issue creation in backlog and sprints", () => {
    expect(hasPermission("ADMIN", "CREATE_ISSUE")).toBe(true);
    expect(hasPermission("MEMBER", "CREATE_ISSUE")).toBe(true);
    expect(hasPermission("VIEWER", "CREATE_ISSUE")).toBe(false);
  });
});

describe("Access Control Policy: Bulk Operations", () => {
  function canPerformBulkSelection(role: ProjectRole): boolean {
    return hasPermission(role, "EDIT_ISSUE") || hasPermission(role, "DELETE_ISSUE");
  }

  it("permits table selection for roles with edit or delete rights", () => {
    expect(canPerformBulkSelection("ADMIN")).toBe(true);
    expect(canPerformBulkSelection("MEMBER")).toBe(true);
  });

  it("disables table selection for Viewers", () => {
    expect(canPerformBulkSelection("VIEWER")).toBe(false);
  });
});
