"use client";

import React, { useState, useMemo } from "react";
import {
  Project,
  User,
  ProjectMember,
  ProjectRole,
  BuiltInRole,
  CustomRole,
  ProjectPermission,
} from "@/types";
import UserAvatar from "@/components/common/UserAvatar";
import {
  ROLE_CONFIG,
  ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  getRoleBadgeConfig,
} from "@/lib/permissions";
import {
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from "@/lib/actions/access";
import {
  Shield,
  Users,
  Eye,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  HelpCircle,
  Crown,
  Info,
  Loader2,
  UserPlus,
  SlidersHorizontal,
  Edit2,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

const PRESET_ROLE_COLORS = [
  { name: "Blue", hex: "#0052cc" },
  { name: "Purple", hex: "#6554c0" },
  { name: "Emerald", hex: "#00875a" },
  { name: "Amber", hex: "#ff991f" },
  { name: "Crimson", hex: "#de350b" },
  { name: "Teal", hex: "#00b8d9" },
  { name: "Violet", hex: "#8777d9" },
  { name: "Slate", hex: "#4b5563" },
];

interface ProjectAccessTabProps {
  project: Project;
  initialMembers: ProjectMember[];
  initialCustomRoles?: CustomRole[];
  allOrgUsers: User[];
  currentUserRole: ProjectRole | null;
  isProjectLead: boolean;
}

export default function ProjectAccessTab({
  project,
  initialMembers,
  initialCustomRoles = [],
  allOrgUsers,
  currentUserRole,
  isProjectLead,
}: ProjectAccessTabProps) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(initialCustomRoles);
  const [activeSubTab, setActiveSubTab] = useState<"members" | "roles">("members");

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const canManage = currentUserRole === "ADMIN" || isProjectLead;

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.user.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.user.role && m.user.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "ALL" || m.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Statistics
  const adminCount = members.filter((m) => m.role === "ADMIN").length;
  const memberCount = members.filter((m) => m.role === "MEMBER").length;
  const viewerCount = members.filter((m) => m.role === "VIEWER").length;
  const customRoleMembersCount = members.filter(
    (m) => m.role !== "ADMIN" && m.role !== "MEMBER" && m.role !== "VIEWER"
  ).length;

  // Non-member users available to invite
  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId));
    return allOrgUsers.filter((u) => !memberIds.has(u.id));
  }, [allOrgUsers, members]);

  // Handle Member Role Change
  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    setUpdatingUserId(userId);
    const matchedCustomRole = customRoles.find((r) => r.name === newRole || r.id === newRole);
    const res = await updateProjectMemberRole(
      project.id,
      userId,
      matchedCustomRole ? matchedCustomRole.name : newRole,
      matchedCustomRole ? matchedCustomRole.id : null
    );
    setUpdatingUserId(null);

    if (res.success && res.member) {
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? (res.member as ProjectMember) : m))
      );
    } else if (res.error) {
      alert(res.error);
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this project?`)) {
      return;
    }

    setRemovingUserId(userId);
    const res = await removeProjectMember(project.id, userId);
    setRemovingUserId(null);

    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } else if (res.error) {
      alert(res.error);
    }
  };

  // Handle Custom Role Deletion
  const handleDeleteRole = async (role: CustomRole) => {
    const assignedCount = members.filter(
      (m) => m.customRoleId === role.id || m.role === role.name
    ).length;

    const confirmMsg =
      assignedCount > 0
        ? `Are you sure you want to delete the role "${role.name}"?\n\n${assignedCount} project member(s) currently assigned to this role will be safely reassigned to the default "Member" role.`
        : `Are you sure you want to delete the role "${role.name}"?`;

    if (!confirm(confirmMsg)) return;

    setDeletingRoleId(role.id);
    const res = await deleteCustomRole(role.id, "MEMBER");
    setDeletingRoleId(null);

    if (res.success) {
      setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
      // Reassign affected members in UI state to MEMBER
      setMembers((prev) =>
        prev.map((m) =>
          m.customRoleId === role.id || m.role === role.name
            ? { ...m, role: "MEMBER", customRoleId: null, customRole: null }
            : m
        )
      );
      if (roleFilter === role.name) {
        setRoleFilter("ALL");
      }
    } else if (res.error) {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-jira-gray-200 pb-px">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("members")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeSubTab === "members"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy hover:border-jira-gray-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members</span>
            <span
              className={`px-1.5 py-px rounded-full text-[10px] font-bold ${
                activeSubTab === "members"
                  ? "bg-jira-blue-light text-jira-blue"
                  : "bg-jira-gray-100 text-jira-gray-600"
              }`}
            >
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("roles")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeSubTab === "roles"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy hover:border-jira-gray-300"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Project Roles</span>
            <span
              className={`px-1.5 py-px rounded-full text-[10px] font-bold ${
                activeSubTab === "roles"
                  ? "bg-jira-blue-light text-jira-blue"
                  : "bg-jira-gray-100 text-jira-gray-600"
              }`}
            >
              {3 + customRoles.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMatrixModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-jira-gray-700 bg-white border border-jira-gray-300 hover:bg-jira-gray-50 rounded flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-jira-gray-500" />
            <span>Permissions Scheme</span>
          </button>

          {canManage && activeSubTab === "roles" && (
            <button
              type="button"
              onClick={() => {
                setEditingRole(null);
                setIsRoleModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover rounded flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Custom Role</span>
            </button>
          )}

          {canManage && activeSubTab === "members" && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover rounded flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: TEAM MEMBERS */}
      {activeSubTab === "members" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-jira-gray-200 text-jira-navy flex items-center justify-center font-bold">
                <Users className="w-5 h-5 text-jira-gray-700" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wider">
                  Total Team
                </div>
                <div className="text-base font-bold text-jira-navy">{members.length} Members</div>
              </div>
            </div>

            <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider">
                  Administrators
                </div>
                <div className="text-base font-bold text-purple-950">{adminCount} Admins</div>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Users className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">
                  Contributors
                </div>
                <div className="text-base font-bold text-blue-950">{memberCount} Members</div>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                  {customRoles.length > 0 ? "Custom & Viewers" : "Stakeholders"}
                </div>
                <div className="text-base font-bold text-amber-950">
                  {viewerCount} Viewers
                  {customRoleMembersCount > 0 && ` + ${customRoleMembersCount} Custom`}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 min-w-full sm:min-w-[280px]">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-jira-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue transition-colors"
                />
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center bg-jira-gray-100 p-0.5 rounded border border-jira-gray-300 text-xs overflow-x-auto no-scrollbar max-w-full">
                {["ALL", "ADMIN", "MEMBER", "VIEWER", ...customRoles.map((r) => r.name)].map(
                  (roleKey) => {
                    const label =
                      roleKey === "ALL"
                        ? "All"
                        : roleKey === "ADMIN"
                        ? "Admins"
                        : roleKey === "MEMBER"
                        ? "Members"
                        : roleKey === "VIEWER"
                        ? "Viewers"
                        : roleKey;

                    const isCustom = customRoles.some((r) => r.name === roleKey);
                    const customRoleObj = customRoles.find((r) => r.name === roleKey);

                    return (
                      <button
                        key={roleKey}
                        onClick={() => setRoleFilter(roleKey)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold text-[11px] whitespace-nowrap transition-colors ${
                          roleFilter === roleKey
                            ? "bg-white text-jira-navy shadow-xs"
                            : "text-jira-gray-600 hover:text-jira-navy"
                        }`}
                      >
                        {isCustom && customRoleObj && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: customRoleObj.color || "#0052cc" }}
                          />
                        )}
                        <span>{label}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="border border-jira-gray-200 rounded-lg overflow-x-auto bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-jira-gray-50 border-b border-jira-gray-200 text-jira-gray-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Project Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jira-gray-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-jira-gray-400 italic">
                      No project members match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const badgeConfig = getRoleBadgeConfig(member.role, customRoles);
                    const isLead = member.userId === project.leadId;
                    const isUpdating = updatingUserId === member.userId;
                    const isRemoving = removingUserId === member.userId;
                    const isCustomRole = badgeConfig.isCustom;

                    return (
                      <tr
                        key={member.id}
                        className="hover:bg-jira-gray-50/60 transition-colors group"
                      >
                        {/* User Profile */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={member.user}
                              size="lg"
                              className="border border-jira-gray-200"
                            />
                            <div>
                              <div className="font-bold text-jira-navy flex items-center gap-1.5">
                                <span>{member.user.name}</span>
                                {isLead && (
                                  <span
                                    title="Project Lead"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-amber-100 text-amber-800 text-[10px] font-bold"
                                  >
                                    <Crown className="w-3 h-3 text-amber-600" />
                                    Lead
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-jira-gray-500">{member.user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Job Title */}
                        <td className="px-4 py-3 text-jira-gray-700 font-medium">
                          <span className="px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-800 font-medium text-[11px]">
                            {member.user.role}
                          </span>
                        </td>

                        {/* Project Role Selector */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {canManage && !isLead ? (
                              <div className="relative">
                                <select
                                  value={member.role}
                                  disabled={isUpdating}
                                  onChange={(e) =>
                                    handleRoleChange(member.userId, e.target.value as ProjectRole)
                                  }
                                  style={
                                    isCustomRole && badgeConfig.color
                                      ? {
                                          backgroundColor: `${badgeConfig.color}15`,
                                          borderColor: `${badgeConfig.color}40`,
                                          color: badgeConfig.color,
                                        }
                                      : undefined
                                  }
                                  className={`text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer transition-colors ${
                                    !isCustomRole
                                      ? `${badgeConfig.badgeBg} ${badgeConfig.badgeText} ${badgeConfig.border}`
                                      : ""
                                  } hover:brightness-95`}
                                >
                                  <optgroup label="System Roles">
                                    <option value="ADMIN">Administrator</option>
                                    <option value="MEMBER">Member (Contributor)</option>
                                    <option value="VIEWER">Viewer (Read-Only)</option>
                                  </optgroup>
                                  {customRoles.length > 0 && (
                                    <optgroup label="Custom Project Roles">
                                      {customRoles.map((cr) => (
                                        <option key={cr.id} value={cr.name}>
                                          {cr.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                                {isUpdating && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-blue absolute -right-5 top-1.5" />
                                )}
                              </div>
                            ) : (
                              <span
                                style={
                                  isCustomRole && badgeConfig.color
                                    ? {
                                        backgroundColor: `${badgeConfig.color}15`,
                                        borderColor: `${badgeConfig.color}40`,
                                        color: badgeConfig.color,
                                      }
                                    : undefined
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-semibold text-xs ${
                                  !isCustomRole
                                    ? `${badgeConfig.badgeBg} ${badgeConfig.badgeText} ${badgeConfig.border}`
                                    : ""
                                }`}
                              >
                                {isCustomRole && badgeConfig.color && (
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: badgeConfig.color }}
                                  />
                                )}
                                {badgeConfig.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="px-4 py-3 text-jira-gray-500 text-[11px]">
                          {member.createdAt ? format(new Date(member.createdAt), "MMM d, yyyy") : "—"}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          {canManage && !isLead && (
                            <button
                              type="button"
                              disabled={isRemoving}
                              onClick={() => handleRemoveMember(member.userId, member.user.name)}
                              title="Remove member from project"
                              className="p-1.5 text-jira-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            >
                              {isRemoving ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PROJECT ROLES & PERMISSIONS */}
      {activeSubTab === "roles" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Header intro */}
          <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border border-blue-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-jira-blue" />
                <h3 className="text-sm font-bold text-jira-navy">Project Roles & Permissions Scheme</h3>
              </div>
              <p className="text-xs text-jira-gray-600 max-w-2xl leading-relaxed">
                Roles define what project members are authorized to do. Trackr comes with 3 standard built-in roles,
                and project administrators can create bespoke custom roles with fine-grained access control.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setEditingRole(null);
                  setIsRoleModalOpen(true);
                }}
                className="self-start sm:self-center shrink-0 px-3.5 py-2 text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover rounded flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Role</span>
              </button>
            )}
          </div>

          {/* Section 1: Standard System Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-jira-gray-500" />
                <h4 className="text-xs font-bold text-jira-navy uppercase tracking-wider">
                  Standard System Roles (3)
                </h4>
              </div>
              <span className="text-[11px] text-jira-gray-500 font-medium">
                System default roles are built-in and immutable
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ADMIN */}
              <div className="bg-white border border-purple-200 rounded-lg p-4.5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Administrator
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Built-in
                    </span>
                  </div>
                  <p className="text-xs text-jira-gray-600 leading-relaxed">
                    {ROLE_CONFIG.ADMIN.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-purple-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-purple-900">
                    10 of 10 Permissions (Full Access)
                  </span>
                  <span className="text-jira-gray-500 font-medium">
                    {adminCount} member{adminCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* MEMBER */}
              <div className="bg-white border border-blue-200 rounded-lg p-4.5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Member (Contributor)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Built-in
                    </span>
                  </div>
                  <p className="text-xs text-jira-gray-600 leading-relaxed">
                    {ROLE_CONFIG.MEMBER.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-blue-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-blue-900">
                    8 Permissions (Issues & Sprints)
                  </span>
                  <span className="text-jira-gray-500 font-medium">
                    {memberCount} member{memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* VIEWER */}
              <div className="bg-white border border-amber-200 rounded-lg p-4.5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Viewer (Read-Only)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Built-in
                    </span>
                  </div>
                  <p className="text-xs text-jira-gray-600 leading-relaxed">
                    {ROLE_CONFIG.VIEWER.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-amber-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-900">
                    1 Permission (View Project)
                  </span>
                  <span className="text-jira-gray-500 font-medium">
                    {viewerCount} member{viewerCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Custom Project Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-jira-blue" />
                <h4 className="text-xs font-bold text-jira-navy uppercase tracking-wider">
                  Custom Project Roles ({customRoles.length})
                </h4>
              </div>
              <span className="text-[11px] text-jira-gray-500 font-medium">
                Tailored permissions for contractors, QA, managers, or release specialists
              </span>
            </div>

            {customRoles.length === 0 ? (
              <div className="bg-jira-gray-50/70 border-2 border-dashed border-jira-gray-200 rounded-lg p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-jira-blue flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-jira-navy">No Custom Roles Yet</h4>
                  <p className="text-xs text-jira-gray-500 max-w-md mx-auto">
                    Project administrators can create tailored project roles with customized permissions
                    (e.g., &quot;QA Tester&quot;, &quot;Release Lead&quot;, or &quot;External Contractor&quot;) and assign team members.
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRole(null);
                      setIsRoleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover rounded transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Custom Role</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customRoles.map((role) => {
                  const assignedCount = members.filter(
                    (m) => m.customRoleId === role.id || m.role === role.name
                  ).length;
                  const perms = Array.isArray(role.permissions)
                    ? role.permissions
                    : (JSON.parse((role.permissions as any) || "[]") as ProjectPermission[]);
                  const color = role.color || "#0052cc";
                  const isDeleting = deletingRoleId === role.id;

                  return (
                    <div
                      key={role.id}
                      className="bg-white border border-jira-gray-200 rounded-lg p-4.5 shadow-2xs space-y-3 flex flex-col justify-between hover:border-jira-gray-300 transition-colors"
                    >
                      <div className="space-y-2.5">
                        {/* Header: Badge & Member Count */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-bold"
                            style={{
                              backgroundColor: `${color}15`,
                              borderColor: `${color}40`,
                              color: color,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span>{role.name}</span>
                          </span>

                          <span className="text-[11px] font-semibold text-jira-gray-500 bg-jira-gray-100 px-2 py-0.5 rounded">
                            {assignedCount} member{assignedCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-jira-gray-600 leading-relaxed min-h-[36px]">
                          {role.description || (
                            <span className="italic text-jira-gray-400">
                              No description provided.
                            </span>
                          )}
                        </p>

                        {/* Permissions Granted Pills */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold text-jira-gray-500 uppercase tracking-wider">
                            Granted Permissions ({perms.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {perms.map((p) => {
                              const meta = PERMISSION_DESCRIPTIONS[p];
                              return (
                                <span
                                  key={p}
                                  title={meta?.description}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-jira-gray-100 text-jira-gray-700"
                                >
                                  {meta?.label || p}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-jira-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-jira-gray-400 font-medium">
                          Custom Project Role
                        </span>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(role);
                                setIsRoleModalOpen(true);
                              }}
                              className="p-1.5 text-jira-gray-500 hover:text-jira-blue hover:bg-blue-50 rounded transition-colors"
                              title="Edit role & permissions"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteRole(role)}
                              className="p-1.5 text-jira-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Delete custom role"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <AddMemberModal
          availableUsers={availableUsers}
          customRoles={customRoles}
          onClose={() => setIsAddModalOpen(false)}
          onMemberAdded={(newMember) => {
            setMembers((prev) => [...prev, newMember]);
            setIsAddModalOpen(false);
          }}
          projectId={project.id}
        />
      )}

      {/* Permissions Scheme Matrix Modal */}
      {isMatrixModalOpen && (
        <PermissionsMatrixModal
          customRoles={customRoles}
          onClose={() => setIsMatrixModalOpen(false)}
        />
      )}

      {/* Create / Edit Custom Role Modal */}
      {isRoleModalOpen && (
        <CreateEditRoleModal
          projectId={project.id}
          existingRole={editingRole}
          existingRoleNames={[
            "ADMIN",
            "MEMBER",
            "VIEWER",
            "ADMINISTRATOR",
            "LEAD",
            ...customRoles
              .filter((r) => !editingRole || r.id !== editingRole.id)
              .map((r) => r.name.toLowerCase()),
          ]}
          onClose={() => {
            setIsRoleModalOpen(false);
            setEditingRole(null);
          }}
          onSaved={(savedRole, isNew) => {
            if (isNew) {
              setCustomRoles((prev) => [...prev, savedRole]);
            } else {
              setCustomRoles((prev) =>
                prev.map((r) => (r.id === savedRole.id ? savedRole : r))
              );
              // Update any member records that had the old role name
              setMembers((prev) =>
                prev.map((m) =>
                  m.customRoleId === savedRole.id
                    ? { ...m, role: savedRole.name, customRole: savedRole }
                    : m
                )
              );
            }
            setIsRoleModalOpen(false);
            setEditingRole(null);
          }}
        />
      )}
    </div>
  );
}

// Sub-Component: Add Member Modal
function AddMemberModal({
  availableUsers,
  customRoles,
  projectId,
  onClose,
  onMemberAdded,
}: {
  availableUsers: User[];
  customRoles: CustomRole[];
  projectId: string;
  onClose: () => void;
  onMemberAdded: (member: ProjectMember) => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState(
    availableUsers.length > 0 ? availableUsers[0].id : ""
  );
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("MEMBER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setErrorMessage("Please select a teammate.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const matchedCustomRole = customRoles.find(
      (r) => r.name === selectedRole || r.id === selectedRole
    );
    const res = await addProjectMember(
      projectId,
      selectedUserId,
      matchedCustomRole ? matchedCustomRole.name : selectedRole,
      matchedCustomRole ? matchedCustomRole.id : null
    );
    setIsSubmitting(false);

    if (res.success && res.member) {
      onMemberAdded(res.member as ProjectMember);
    } else {
      setErrorMessage(res.error || "Failed to add member to project.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-jira-blue" />
            <h2 className="text-base font-bold text-jira-navy">Add Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-400 hover:text-jira-navy rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {availableUsers.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <Users className="w-8 h-8 text-jira-gray-400 mx-auto" />
            <p className="text-xs text-jira-gray-600 font-medium">
              All organization users are already members of this project!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1">
            {errorMessage && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                Teammate
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-jira-gray-300 rounded p-2 text-jira-navy font-medium focus:border-jira-blue"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px]">
                Project Role
              </label>

              {/* System Roles */}
              <div className="space-y-2">
                {(["ADMIN", "MEMBER", "VIEWER"] as BuiltInRole[]).map((role) => {
                  const cfg = ROLE_CONFIG[role];
                  return (
                    <label
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRole === role
                          ? "bg-jira-blue-light/30 border-jira-blue"
                          : "border-jira-gray-200 hover:bg-jira-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectRole"
                        checked={selectedRole === role}
                        onChange={() => setSelectedRole(role)}
                        className="mt-0.5 text-jira-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-jira-navy">{cfg.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-px rounded border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`}
                          >
                            {role}
                          </span>
                        </div>
                        <p className="text-[11px] text-jira-gray-600 mt-0.5">
                          {cfg.description}
                        </p>
                      </div>
                    </label>
                  );
                })}

                {/* Custom Roles (if any) */}
                {customRoles.map((cr) => {
                  const color = cr.color || "#0052cc";
                  return (
                    <label
                      key={cr.id}
                      onClick={() => setSelectedRole(cr.name)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRole === cr.name
                          ? "bg-jira-blue-light/30 border-jira-blue"
                          : "border-jira-gray-200 hover:bg-jira-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectRole"
                        checked={selectedRole === cr.name}
                        onChange={() => setSelectedRole(cr.name)}
                        className="mt-0.5 text-jira-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-jira-navy">{cr.name}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-px rounded border flex items-center gap-1"
                            style={{
                              backgroundColor: `${color}15`,
                              borderColor: `${color}40`,
                              color: color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            Custom
                          </span>
                        </div>
                        <p className="text-[11px] text-jira-gray-600 mt-0.5">
                          {cr.description || "Custom project role with tailored permissions."}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-jira-gray-200 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-jira-gray-600 hover:bg-jira-gray-100 rounded font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white px-4 py-2 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add Member</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Sub-Component: Create / Edit Custom Role Modal
function CreateEditRoleModal({
  projectId,
  existingRole,
  existingRoleNames,
  onClose,
  onSaved,
}: {
  projectId: string;
  existingRole: CustomRole | null;
  existingRoleNames: string[];
  onClose: () => void;
  onSaved: (role: CustomRole, isNew: boolean) => void;
}) {
  const isEditing = !!existingRole;

  const [name, setName] = useState(existingRole?.name || "");
  const [description, setDescription] = useState(existingRole?.description || "");
  const [color, setColor] = useState(existingRole?.color || "#0052cc");

  const initialPermissions = useMemo<ProjectPermission[]>(() => {
    if (!existingRole) {
      return [
        "VIEW_PROJECT",
        "CREATE_ISSUE",
        "EDIT_ISSUE",
        "MOVE_ISSUE",
        "ADD_COMMENT",
      ];
    }
    const perms = Array.isArray(existingRole.permissions)
      ? existingRole.permissions
      : (JSON.parse((existingRole.permissions as any) || "[]") as ProjectPermission[]);
    return perms;
  }, [existingRole]);

  const [selectedPermissions, setSelectedPermissions] =
    useState<Set<ProjectPermission>>(new Set(initialPermissions));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const togglePermission = (perm: ProjectPermission) => {
    if (perm === "VIEW_PROJECT") return; // VIEW_PROJECT is mandatory

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = Object.keys(PERMISSION_DESCRIPTIONS) as ProjectPermission[];
    setSelectedPermissions(new Set<ProjectPermission>(all));
  };

  const clearOptional = () => {
    setSelectedPermissions(new Set<ProjectPermission>(["VIEW_PROJECT"]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a role name.");
      return;
    }

    if (existingRoleNames.includes(trimmed.toLowerCase())) {
      setErrorMessage("A role with this name already exists in this project or is reserved.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const permsArray = Array.from(selectedPermissions);

    if (isEditing && existingRole) {
      const res = await updateCustomRole(existingRole.id, {
        name: trimmed,
        description: description.trim() || undefined,
        color,
        permissions: permsArray,
      });
      setIsSubmitting(false);

      if (res.success && res.role) {
        onSaved(res.role as CustomRole, false);
      } else {
        setErrorMessage(res.error || "Failed to update custom role.");
      }
    } else {
      const res = await createCustomRole(projectId, {
        name: trimmed,
        description: description.trim() || undefined,
        color,
        permissions: permsArray,
      });
      setIsSubmitting(false);

      if (res.success && res.role) {
        onSaved(res.role as CustomRole, true);
      } else {
        setErrorMessage(res.error || "Failed to create custom role.");
      }
    }
  };

  // Group permissions by category
  const permissionCategories: Array<{
    category: "Administration" | "Agile" | "Issues";
    title: string;
    items: Array<[ProjectPermission, (typeof PERMISSION_DESCRIPTIONS)[ProjectPermission]]>;
  }> = [
    {
      category: "Administration",
      title: "Project Administration & Access",
      items: (
        Object.entries(PERMISSION_DESCRIPTIONS) as Array<
          [ProjectPermission, (typeof PERMISSION_DESCRIPTIONS)[ProjectPermission]]
        >
      ).filter(([_, meta]) => meta.category === "Administration"),
    },
    {
      category: "Agile",
      title: "Agile Sprints & Releases",
      items: (
        Object.entries(PERMISSION_DESCRIPTIONS) as Array<
          [ProjectPermission, (typeof PERMISSION_DESCRIPTIONS)[ProjectPermission]]
        >
      ).filter(([_, meta]) => meta.category === "Agile"),
    },
    {
      category: "Issues",
      title: "Issue Tracking & Collaboration",
      items: (
        Object.entries(PERMISSION_DESCRIPTIONS) as Array<
          [ProjectPermission, (typeof PERMISSION_DESCRIPTIONS)[ProjectPermission]]
        >
      ).filter(([_, meta]) => meta.category === "Issues"),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-jira-blue" />
            <div>
              <h2 className="text-base font-bold text-jira-navy">
                {isEditing ? "Edit Custom Role" : "Create Custom Project Role"}
              </h2>
              <p className="text-xs text-jira-gray-500">
                Configure role details, branding color, and fine-grained permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-400 hover:text-jira-navy rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {errorMessage && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. QA Specialist, Release Manager, Contractor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-jira-gray-300 rounded text-jira-navy font-semibold focus:border-jira-blue"
              />
            </div>

            <div>
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 p-0.5 rounded border border-jira-gray-300 cursor-pointer bg-white"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_ROLE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-4 h-4 rounded-full border transition-transform ${
                        color.toLowerCase() === c.hex.toLowerCase()
                          ? "scale-125 border-jira-navy shadow-xs"
                          : "border-transparent hover:scale-110"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px] mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Explain the scope and responsibilities of this role..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-jira-gray-300 rounded text-jira-navy focus:border-jira-blue"
            />
          </div>

          {/* Permissions Checklist */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-jira-gray-200">
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px]">
                Permissions Scheme ({selectedPermissions.size} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-jira-blue hover:underline"
                >
                  Select All
                </button>
                <span className="text-jira-gray-300">•</span>
                <button
                  type="button"
                  onClick={clearOptional}
                  className="text-[11px] font-semibold text-jira-gray-600 hover:text-jira-navy hover:underline"
                >
                  Clear Optional
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {permissionCategories.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <div className="text-[11px] font-bold text-jira-navy bg-jira-gray-50 px-2 py-1 rounded border border-jira-gray-200">
                    {cat.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.items.map(([permKey, permMeta]) => {
                      const isMandatory = permKey === "VIEW_PROJECT";
                      const isChecked = selectedPermissions.has(permKey);

                      return (
                        <label
                          key={permKey}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-blue-50/40 border-jira-blue/60"
                              : "border-jira-gray-200 hover:bg-jira-gray-50/70"
                          } ${isMandatory ? "opacity-90 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={isMandatory}
                            checked={isChecked}
                            onChange={() => togglePermission(permKey)}
                            className="mt-0.5 rounded text-jira-blue focus:ring-jira-blue"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-jira-navy">{permMeta.label}</span>
                              {isMandatory && (
                                <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-jira-gray-500 leading-tight mt-0.5">
                              {permMeta.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-jira-gray-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-jira-gray-600 hover:bg-jira-gray-100 rounded font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white px-4 py-2 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Save Changes" : "Create Role"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Sub-Component: Permissions Matrix Modal
function PermissionsMatrixModal({
  customRoles,
  onClose,
}: {
  customRoles: CustomRole[];
  onClose: () => void;
}) {
  const builtInRoles: Array<{ key: BuiltInRole; name: string }> = [
    { key: "ADMIN", name: "Administrator" },
    { key: "MEMBER", name: "Member" },
    { key: "VIEWER", name: "Viewer" },
  ];
  const permissions = Object.entries(PERMISSION_DESCRIPTIONS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-jira-blue" />
            <div>
              <h2 className="text-base font-bold text-jira-navy">Permissions Scheme Matrix</h2>
              <p className="text-xs text-jira-gray-500">
                Detailed access breakdown across standard system roles and custom project roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-400 hover:text-jira-navy rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto flex-1 border border-jira-gray-200 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-jira-gray-100 border-b border-jira-gray-200 font-bold text-[11px] text-jira-navy sticky top-0 z-10">
                <th className="px-4 py-3 min-w-[200px]">Permission Category & Action</th>
                {builtInRoles.map((r) => (
                  <th key={r.key} className="px-3 py-3 text-center min-w-[90px]">
                    {r.name}
                  </th>
                ))}
                {customRoles.map((cr) => (
                  <th key={cr.id} className="px-3 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cr.color || "#0052cc" }}
                      />
                      <span>{cr.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-jira-gray-100">
              {permissions.map(([permKey, permMeta]) => {
                return (
                  <tr key={permKey} className="hover:bg-jira-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-jira-navy">{permMeta.label}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-px rounded bg-jira-gray-100 text-jira-gray-600">
                          {permMeta.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-jira-gray-500 mt-0.5">
                        {permMeta.description}
                      </p>
                    </td>

                    {/* Built-in roles */}
                    {builtInRoles.map(({ key }) => {
                      const isAllowed = ROLE_PERMISSIONS[key]?.includes(permKey as ProjectPermission);
                      return (
                        <td key={key} className="px-3 py-2.5 text-center">
                          {isAllowed ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-jira-gray-100 text-jira-gray-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Custom roles */}
                    {customRoles.map((cr) => {
                      const perms: ProjectPermission[] = Array.isArray(cr.permissions)
                        ? cr.permissions
                        : typeof cr.permissions === "string"
                        ? JSON.parse(cr.permissions || "[]")
                        : [];
                      const isAllowed = perms.includes(permKey as any);

                      return (
                        <td key={cr.id} className="px-3 py-2.5 text-center">
                          {isAllowed ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                              style={{
                                backgroundColor: `${cr.color || "#0052cc"}20`,
                                color: cr.color || "#0052cc",
                              }}
                            >
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-jira-gray-100 text-jira-gray-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-jira-gray-100 hover:bg-jira-gray-200 text-jira-navy font-semibold text-xs rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
