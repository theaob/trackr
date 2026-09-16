"use client";

import { useMemo } from "react";
import { Project, ProjectMember, ProjectRole } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import {
  resolveUserProjectRole,
  hasPermission,
  ROLE_CONFIG,
} from "@/lib/permissions";

export function useProjectPermissions(
  project?: Project | null,
  members?: ProjectMember[] | null
) {
  const { currentUser } = useCurrentUser();

  const role: ProjectRole | null = useMemo(() => {
    return resolveUserProjectRole(currentUser?.id, project, members);
  }, [currentUser?.id, project, members]);

  const permissions = useMemo(() => {
    const isLead = !!(project?.leadId && currentUser?.id === project.leadId);
    const isAdmin = role === "ADMIN" || isLead;
    const isMember = role === "MEMBER";
    const isViewer = role === "VIEWER" && !isLead;
    const canViewProject = isAdmin || hasPermission(role, "VIEW_PROJECT");

    const defaultRoleConfig = {
      name: "No Access",
      description: "You do not have access permissions for this project.",
      badgeBg: "bg-gray-100",
      badgeText: "text-gray-600",
      border: "border-gray-200",
    };

    return {
      role,
      roleConfig: role ? ROLE_CONFIG[role] : defaultRoleConfig,
      isLead,
      isAdmin,
      isMember,
      isViewer,
      canViewProject,
      canManageProject: isAdmin || hasPermission(role, "PROJECT_ADMIN"),
      canManageAccess: isAdmin || hasPermission(role, "MANAGE_ACCESS"),
      canManageSprints: isAdmin || hasPermission(role, "MANAGE_SPRINTS"),
      canManageVersions: isAdmin || hasPermission(role, "MANAGE_VERSIONS"),
      canCreateIssue: isAdmin || hasPermission(role, "CREATE_ISSUE"),
      canEditIssue: isAdmin || hasPermission(role, "EDIT_ISSUE"),
      canDeleteIssue: isAdmin || hasPermission(role, "DELETE_ISSUE"),
      canMoveIssue: isAdmin || hasPermission(role, "MOVE_ISSUE"),
      canAddComment: isAdmin || hasPermission(role, "ADD_COMMENT"),
    };
  }, [role, project?.leadId, currentUser?.id]);

  return permissions;
}
