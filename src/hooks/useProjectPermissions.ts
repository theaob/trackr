"use client";

import { useMemo } from "react";
import { Project, ProjectMember, ProjectRole, CustomRole } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import {
  resolveUserProjectRole,
  hasPermission,
  getRoleBadgeConfig,
} from "@/lib/permissions";

export function useProjectPermissions(
  project?: Project | null,
  members?: ProjectMember[] | null,
  customRoles?: CustomRole[] | null
) {
  const { currentUser } = useCurrentUser();
  const allCustomRoles = useMemo(
    () => customRoles || project?.customRoles || [],
    [customRoles, project?.customRoles]
  );

  const role: ProjectRole | null = useMemo(() => {
    return resolveUserProjectRole(currentUser?.id, project, members);
  }, [currentUser?.id, project, members]);

  const permissions = useMemo(() => {
    const isLead = !!(project?.leadId && currentUser?.id === project.leadId);
    const isAdmin = role === "ADMIN" || isLead;
    const isMember = role === "MEMBER";
    const isViewer = role === "VIEWER" && !isLead;
    const canViewProject = isAdmin || hasPermission(role, "VIEW_PROJECT", allCustomRoles);
    const roleConfig = getRoleBadgeConfig(role, allCustomRoles);

    return {
      role,
      roleConfig,
      isLead,
      isAdmin,
      isMember,
      isViewer,
      canViewProject,
      canManageProject: isAdmin || hasPermission(role, "PROJECT_ADMIN", allCustomRoles),
      canManageAccess: isAdmin || hasPermission(role, "MANAGE_ACCESS", allCustomRoles),
      canManageSprints: isAdmin || hasPermission(role, "MANAGE_SPRINTS", allCustomRoles),
      canManageVersions: isAdmin || hasPermission(role, "MANAGE_VERSIONS", allCustomRoles),
      canCreateIssue: isAdmin || hasPermission(role, "CREATE_ISSUE", allCustomRoles),
      canEditIssue: isAdmin || hasPermission(role, "EDIT_ISSUE", allCustomRoles),
      canDeleteIssue: isAdmin || hasPermission(role, "DELETE_ISSUE", allCustomRoles),
      canMoveIssue: isAdmin || hasPermission(role, "MOVE_ISSUE", allCustomRoles),
      canAddComment: isAdmin || hasPermission(role, "ADD_COMMENT", allCustomRoles),
    };
  }, [role, project?.leadId, currentUser?.id, allCustomRoles]);

  return permissions;
}
