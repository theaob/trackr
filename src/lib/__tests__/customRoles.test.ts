import { describe, expect, it } from "vitest";
import {
  hasPermission,
  getRoleBadgeConfig,
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
import { CustomRole, ProjectPermission } from "@/types";

describe("Custom Project Roles - Permissions & Badge Logic", () => {
  const qaTesterRole: CustomRole = {
    id: "role-qa-1",
    projectId: "proj-1",
    name: "QA Tester",
    description: "Quality assurance engineer testing and logging issues",
    color: "#00b8d9",
    permissions: ["VIEW_PROJECT", "CREATE_ISSUE", "EDIT_ISSUE", "ADD_COMMENT"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const releaseManagerRole: CustomRole = {
    id: "role-rm-1",
    projectId: "proj-1",
    name: "Release Manager",
    description: "Manages releases and active sprints",
    color: "#6554c0",
    permissions: JSON.stringify([
      "VIEW_PROJECT",
      "MANAGE_VERSIONS",
      "MANAGE_SPRINTS",
      "ADD_COMMENT",
    ]) as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const contractorRole: CustomRole = {
    id: "role-contractor-1",
    projectId: "proj-1",
    name: "Contractor",
    description: "External contractor with view-only and comment rights",
    color: "#ff991f",
    permissions: ["VIEW_PROJECT", "ADD_COMMENT"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customRoles = [qaTesterRole, releaseManagerRole, contractorRole];

  describe("hasPermission with Custom Roles", () => {
    it("evaluates custom role permissions when matched by role name", () => {
      expect(hasPermission("QA Tester", "VIEW_PROJECT", customRoles)).toBe(true);
      expect(hasPermission("QA Tester", "CREATE_ISSUE", customRoles)).toBe(true);
      expect(hasPermission("QA Tester", "EDIT_ISSUE", customRoles)).toBe(true);
      expect(hasPermission("QA Tester", "ADD_COMMENT", customRoles)).toBe(true);
      // Denied permissions:
      expect(hasPermission("QA Tester", "DELETE_ISSUE", customRoles)).toBe(false);
      expect(hasPermission("QA Tester", "PROJECT_ADMIN", customRoles)).toBe(false);
      expect(hasPermission("QA Tester", "MANAGE_ACCESS", customRoles)).toBe(false);
      expect(hasPermission("QA Tester", "MANAGE_SPRINTS", customRoles)).toBe(false);
    });

    it("evaluates custom role permissions when matched by role id", () => {
      expect(hasPermission("role-qa-1", "CREATE_ISSUE", customRoles)).toBe(true);
      expect(hasPermission("role-qa-1", "DELETE_ISSUE", customRoles)).toBe(false);
    });

    it("evaluates custom roles where permissions is serialized as JSON string", () => {
      expect(hasPermission("Release Manager", "MANAGE_VERSIONS", customRoles)).toBe(true);
      expect(hasPermission("Release Manager", "MANAGE_SPRINTS", customRoles)).toBe(true);
      expect(hasPermission("Release Manager", "CREATE_ISSUE", customRoles)).toBe(false);
      expect(hasPermission("Release Manager", "DELETE_ISSUE", customRoles)).toBe(false);
    });

    it("restricts contractor role to view and comment only", () => {
      expect(hasPermission("Contractor", "VIEW_PROJECT", customRoles)).toBe(true);
      expect(hasPermission("Contractor", "ADD_COMMENT", customRoles)).toBe(true);
      expect(hasPermission("Contractor", "CREATE_ISSUE", customRoles)).toBe(false);
      expect(hasPermission("Contractor", "EDIT_ISSUE", customRoles)).toBe(false);
      expect(hasPermission("Contractor", "DELETE_ISSUE", customRoles)).toBe(false);
    });

    it("returns false if custom role is not present in customRoles list", () => {
      expect(hasPermission("NonExistentRole", "VIEW_PROJECT", customRoles)).toBe(false);
      expect(hasPermission("QA Tester", "VIEW_PROJECT", [])).toBe(false);
      expect(hasPermission("QA Tester", "VIEW_PROJECT", null)).toBe(false);
    });
  });

  describe("Permission helper functions with custom roles", () => {
    it("canManageProject reflects custom role settings", () => {
      expect(canManageProject("QA Tester", customRoles)).toBe(false);
      expect(canManageProject("ADMIN", customRoles)).toBe(true);
    });

    it("canManageAccess reflects custom role settings", () => {
      expect(canManageAccess("QA Tester", customRoles)).toBe(false);
      expect(canManageAccess("Release Manager", customRoles)).toBe(false);
    });

    it("canManageSprints and canManageVersions reflect custom role settings", () => {
      expect(canManageSprints("Release Manager", customRoles)).toBe(true);
      expect(canManageVersions("Release Manager", customRoles)).toBe(true);
      expect(canManageSprints("QA Tester", customRoles)).toBe(false);
      expect(canManageVersions("QA Tester", customRoles)).toBe(false);
    });

    it("canCreateIssue, canEditIssue, canDeleteIssue reflect custom role settings", () => {
      expect(canCreateIssue("QA Tester", customRoles)).toBe(true);
      expect(canEditIssue("QA Tester", customRoles)).toBe(true);
      expect(canDeleteIssue("QA Tester", customRoles)).toBe(false);

      expect(canCreateIssue("Contractor", customRoles)).toBe(false);
      expect(canAddComment("Contractor", customRoles)).toBe(true);
    });
  });

  describe("getRoleBadgeConfig", () => {
    it("returns built-in configs for system roles", () => {
      const adminConfig = getRoleBadgeConfig("ADMIN", customRoles);
      expect(adminConfig.name).toBe("Administrator");
      expect(adminConfig.badgeBg).toBe("bg-purple-100");
      expect(adminConfig.isCustom).toBeUndefined();

      const memberConfig = getRoleBadgeConfig("MEMBER", customRoles);
      expect(memberConfig.name).toBe("Member");
      expect(memberConfig.badgeBg).toBe("bg-blue-100");

      const viewerConfig = getRoleBadgeConfig("VIEWER", customRoles);
      expect(viewerConfig.name).toBe("Viewer");
      expect(viewerConfig.badgeBg).toBe("bg-amber-100");
    });

    it("returns custom configuration with branding color for custom roles", () => {
      const qaConfig = getRoleBadgeConfig("QA Tester", customRoles);
      expect(qaConfig.name).toBe("QA Tester");
      expect(qaConfig.isCustom).toBe(true);
      expect(qaConfig.color).toBe("#00b8d9");
      expect(qaConfig.description).toBe(
        "Quality assurance engineer testing and logging issues"
      );

      const rmConfig = getRoleBadgeConfig("role-rm-1", customRoles);
      expect(rmConfig.name).toBe("Release Manager");
      expect(rmConfig.isCustom).toBe(true);
      expect(rmConfig.color).toBe("#6554c0");
    });

    it("handles null or undefined role gracefully", () => {
      const noAccess = getRoleBadgeConfig(null);
      expect(noAccess.name).toBe("No Access");

      const undefinedRole = getRoleBadgeConfig(undefined);
      expect(undefinedRole.name).toBe("No Access");
    });

    it("falls back cleanly for unrecognized role strings", () => {
      const fallback = getRoleBadgeConfig("UnknownRole", customRoles);
      expect(fallback.name).toBe("UnknownRole");
      expect(fallback.badgeBg).toBe("bg-blue-50");
    });
  });
});
