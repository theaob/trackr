import { ProjectRole, ProjectPermission, Project, ProjectMember, User } from "@/types";

export const ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermission[]> = {
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
  ProjectRole,
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

export function hasPermission(role: ProjectRole | null | undefined, permission: ProjectPermission): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
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

export function canManageProject(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "PROJECT_ADMIN");
}

export function canManageAccess(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "MANAGE_ACCESS");
}

export function canManageSprints(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "MANAGE_SPRINTS");
}

export function canManageVersions(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "MANAGE_VERSIONS");
}

export function canCreateIssue(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "CREATE_ISSUE");
}

export function canEditIssue(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "EDIT_ISSUE");
}

export function canDeleteIssue(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "DELETE_ISSUE");
}

export function canMoveIssue(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "MOVE_ISSUE");
}

export function canAddComment(role: ProjectRole | null | undefined): boolean {
  return hasPermission(role, "ADD_COMMENT");
}
