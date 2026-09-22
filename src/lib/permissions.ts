import {
  ProjectRole,
  BuiltInRole,
  ProjectPermission,
  Project,
  ProjectMember,
  User,
  CustomRole,
} from "@/types";

export const ROLE_PERMISSIONS: Record<BuiltInRole, ProjectPermission[]> = {
  ADMIN: [
    "PROJECT_ADMIN",
    "MANAGE_ACCESS",
    "MANAGE_SPRINTS",
    "MANAGE_VERSIONS",
    "CREATE_ISSUE",
    "EDIT_ISSUE",
    "DELETE_ISSUE",
    "MOVE_ISSUE",
    "ADD_COMMENT",
    "VIEW_PROJECT",
  ],
  MEMBER: [
    "MANAGE_SPRINTS",
    "MANAGE_VERSIONS",
    "CREATE_ISSUE",
    "EDIT_ISSUE",
    "DELETE_ISSUE",
    "MOVE_ISSUE",
    "ADD_COMMENT",
    "VIEW_PROJECT",
  ],
  VIEWER: ["VIEW_PROJECT"],
};

export const ROLE_CONFIG: Record<
  BuiltInRole,
  {
    name: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  ADMIN: {
    name: "Administrator",
    description: "Full administrative control over settings, team access, custom fields, webhooks, sprints, and issues.",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    border: "border-purple-200",
  },
  MEMBER: {
    name: "Member",
    description: "Can create and edit issues, drag and reorder cards, participate in sprints, and add comments.",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    border: "border-blue-200",
  },
  VIEWER: {
    name: "Viewer",
    description: "Read-only stakeholder access. Can browse the board, backlog, and issue details without making changes.",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    border: "border-amber-200",
  },
};

export const PERMISSION_DESCRIPTIONS: Record<
  ProjectPermission,
  { label: string; description: string; category: "Administration" | "Issues" | "Agile" }
> = {
  PROJECT_ADMIN: {
    label: "Project Administration",
    description: "Modify project name, key, description, custom fields, and webhooks",
    category: "Administration",
  },
  MANAGE_ACCESS: {
    label: "Manage Access & Roles",
    description: "Invite members, change project roles, and remove team members",
    category: "Administration",
  },
  MANAGE_SPRINTS: {
    label: "Sprint Management",
    description: "Create sprints, start active sprints, and complete sprints",
    category: "Agile",
  },
  MANAGE_VERSIONS: {
    label: "Release Management",
    description: "Create, schedule, and release project versions",
    category: "Agile",
  },
  CREATE_ISSUE: {
    label: "Create Issues",
    description: "Create stories, tasks, bugs, and epics",
    category: "Issues",
  },
  EDIT_ISSUE: {
    label: "Edit Issues",
    description: "Update title, description, assignees, priorities, and custom fields",
    category: "Issues",
  },
  DELETE_ISSUE: {
    label: "Delete Issues",
    description: "Permanently delete issues and subtasks",
    category: "Issues",
  },
  MOVE_ISSUE: {
    label: "Move & Reorder Issues",
    description: "Drag-and-drop issues between columns and sprints",
    category: "Issues",
  },
  ADD_COMMENT: {
    label: "Add Comments",
    description: "Post comments and participate in issue activity discussions",
    category: "Issues",
  },
  VIEW_PROJECT: {
    label: "View Project",
    description: "Access and view the Kanban board, Backlog, and issue details",
    category: "Issues",
  },
};

export function hasPermission(
  role: ProjectRole | null | undefined,
  permission: ProjectPermission,
  customRoles?: CustomRole[] | null
): boolean {
  if (!role) return false;

  if (role in ROLE_PERMISSIONS) {
    const allowed = ROLE_PERMISSIONS[role as BuiltInRole] || [];
    return allowed.includes(permission);
  }

  if (customRoles) {
    const custom = customRoles.find((r) => r.name === role || r.id === role);
    if (custom) {
      const perms: ProjectPermission[] = Array.isArray(custom.permissions)
        ? custom.permissions
        : typeof custom.permissions === "string"
        ? JSON.parse(custom.permissions || "[]")
        : [];
      return perms.includes(permission);
    }
  }

  return false;
}

export function getRoleBadgeConfig(
  role: ProjectRole | null | undefined,
  customRoles?: CustomRole[] | null
): {
  name: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  isCustom?: boolean;
  color?: string;
} {
  if (!role) {
    return {
      name: "No Access",
      description: "You do not have access permissions for this project.",
      badgeBg: "bg-gray-100",
      badgeText: "text-gray-600",
      border: "border-gray-200",
    };
  }

  if (role in ROLE_CONFIG) {
    return ROLE_CONFIG[role as BuiltInRole];
  }

  if (customRoles) {
    const custom = customRoles.find((r) => r.name === role || r.id === role);
    if (custom) {
      return {
        name: custom.name,
        description: custom.description || "Custom project role",
        badgeBg: "bg-slate-50",
        badgeText: "text-slate-800",
        border: "border-slate-300",
        isCustom: true,
        color: custom.color,
      };
    }
  }

  return {
    name: role,
    description: "Project Role",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    border: "border-blue-200",
  };
}

export function resolveUserProjectRole(
  userId?: string | null,
  project?: any | null,
  members?: any[] | null
): ProjectRole | null {
  // A project that allows anonymous viewers falls back to read-only access for
  // anyone without a membership, signed in or not. VIEWER holds VIEW_PROJECT
  // and nothing else, so every write is refused by the same permission table.
  const anonymousFallback: ProjectRole | null = project?.allowAnonymousViewers
    ? "VIEWER"
    : null;

  if (!userId) return anonymousFallback;

  // Project Lead is automatically Project Administrator
  if (project?.leadId && project.leadId === userId) {
    return "ADMIN";
  }

  // Check explicit project membership list
  const memberList = members || project?.members || [];
  const member = memberList.find((m: any) => m.userId === userId);
  if (member) {
    return member.role as ProjectRole;
  }

  // Not a member. There is deliberately no permissive fallback beyond the
  // anonymous one above -- server-side checks in lib/auth/guards.ts resolve
  // roles the same way.
  return anonymousFallback;
}

export function canManageProject(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "PROJECT_ADMIN", customRoles);
}

export function canManageAccess(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "MANAGE_ACCESS", customRoles);
}

export function canManageSprints(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "MANAGE_SPRINTS", customRoles);
}

export function canManageVersions(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "MANAGE_VERSIONS", customRoles);
}

export function canCreateIssue(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "CREATE_ISSUE", customRoles);
}

export function canEditIssue(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "EDIT_ISSUE", customRoles);
}

export function canDeleteIssue(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "DELETE_ISSUE", customRoles);
}

export function canMoveIssue(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "MOVE_ISSUE", customRoles);
}

export function canAddComment(role: ProjectRole | null | undefined, customRoles?: CustomRole[] | null): boolean {
  return hasPermission(role, "ADD_COMMENT", customRoles);
}

/** What a role can do, for comparing one role's reach against another's. */
export interface RoleAuthority {
  isAdmin: boolean;
  permissions: ProjectPermission[];
}

/** A custom role's permissions, whether stored as a JSON string or already parsed. */
export function parseRolePermissions(permissions: unknown): ProjectPermission[] {
  if (Array.isArray(permissions)) return permissions as ProjectPermission[];
  if (typeof permissions === "string") {
    try {
      const parsed = JSON.parse(permissions || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** The authority a role name confers. Unknown roles confer nothing. */
export function authorityOfRole(
  role: string | null | undefined,
  customRoles?: { id: string; name: string; permissions: unknown }[] | null
): RoleAuthority {
  if (!role) return { isAdmin: false, permissions: [] };
  if (role === "ADMIN") return { isAdmin: true, permissions: [...ROLE_PERMISSIONS.ADMIN] };
  if (role in ROLE_PERMISSIONS) {
    return { isAdmin: false, permissions: [...ROLE_PERMISSIONS[role as BuiltInRole]] };
  }
  const custom = customRoles?.find((r) => r.name === role || r.id === role);
  return { isAdmin: false, permissions: custom ? parseRolePermissions(custom.permissions) : [] };
}

/**
 * Whether someone with `caller` authority may grant, change or take away a
 * role with `target` authority. Admins may manage any role; anyone else only
 * roles within their own reach, so the right to manage access can never be
 * used to gain more of it -- for themselves or for anyone else.
 */
export function canManageRoleWithAuthority(caller: RoleAuthority, target: RoleAuthority): boolean {
  if (caller.isAdmin) return true;
  if (target.isAdmin) return false;
  return target.permissions.every((p) => caller.permissions.includes(p));
}
