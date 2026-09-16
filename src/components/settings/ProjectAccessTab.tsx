"use client";

import React, { useState, useMemo } from "react";
import { Project, User, ProjectMember, ProjectRole } from "@/types";
import {
  ROLE_CONFIG,
  ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
} from "@/lib/permissions";
import {
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
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
} from "lucide-react";
import { format } from "date-fns";

interface ProjectAccessTabProps {
  project: Project;
  initialMembers: ProjectMember[];
  allOrgUsers: User[];
  currentUserRole: ProjectRole;
  isProjectLead: boolean;
}

export default function ProjectAccessTab({
  project,
  initialMembers,
  allOrgUsers,
  currentUserRole,
  isProjectLead,
}: ProjectAccessTabProps) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const canManage = currentUserRole === "ADMIN" || isProjectLead;

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.user.role && m.user.role.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = roleFilter === "ALL" || m.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Statistics
  const adminCount = members.filter((m) => m.role === "ADMIN").length;
  const memberCount = members.filter((m) => m.role === "MEMBER").length;
  const viewerCount = members.filter((m) => m.role === "VIEWER").length;

  // Non-member users available to invite
  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId));
    return allOrgUsers.filter((u) => !memberIds.has(u.id));
  }, [allOrgUsers, members]);

  // Handle Role Change
  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    setUpdatingUserId(userId);
    const res = await updateProjectMemberRole(project.id, userId, newRole);
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

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-lg p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-jira-gray-200 text-jira-navy flex items-center justify-center font-bold">
            <Users className="w-5 h-5 text-jira-gray-700" />
          </div>
          <div>
            <div className="text-xs font-semibold text-jira-gray-600 uppercase tracking-wider">
              Total Team
            </div>
            <div className="text-lg font-bold text-jira-navy">{members.length} Members</div>
          </div>
        </div>

        <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <div className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
              Administrators
            </div>
            <div className="text-lg font-bold text-purple-950">{adminCount} Admins</div>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
              Contributors
            </div>
            <div className="text-lg font-bold text-blue-950">{memberCount} Members</div>
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Eye className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              Stakeholders
            </div>
            <div className="text-lg font-bold text-amber-950">{viewerCount} Viewers</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-jira-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none transition-colors"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center bg-jira-gray-100 p-0.5 rounded border border-jira-gray-300 text-xs">
            {["ALL", "ADMIN", "MEMBER", "VIEWER"].map((roleKey) => (
              <button
                key={roleKey}
                onClick={() => setRoleFilter(roleKey)}
                className={`px-2 py-1 rounded font-semibold text-[11px] transition-colors ${
                  roleFilter === roleKey
                    ? "bg-white text-jira-blue shadow-xs"
                    : "text-jira-gray-600 hover:text-jira-navy"
                }`}
              >
                {roleKey === "ALL" ? "All" : roleKey.charAt(0) + roleKey.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMatrixModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-jira-gray-700 bg-white border border-jira-gray-300 hover:bg-jira-gray-50 rounded flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-jira-gray-500" />
            <span>Permissions Scheme</span>
          </button>

          {canManage && (
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

      {/* Members Table */}
      <div className="border border-jira-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
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
                const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.MEMBER;
                const isLead = member.userId === project.leadId;
                const isUpdating = updatingUserId === member.userId;
                const isRemoving = removingUserId === member.userId;

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-jira-gray-50/60 transition-colors group"
                  >
                    {/* User Profile */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {member.user.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                            className="w-8 h-8 rounded-full object-cover border border-jira-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-jira-blue text-white font-bold text-xs flex items-center justify-center">
                            {member.user.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-jira-navy flex items-center gap-1.5">
                            <span>{member.user.name}</span>
                            {isLead && (
                              <span
                                title="Project Lead"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold"
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
                              className={`text-xs font-semibold px-2.5 py-1 rounded border outline-none cursor-pointer transition-colors ${
                                config.badgeBg
                              } ${config.badgeText} ${config.border} hover:brightness-95`}
                            >
                              <option value="ADMIN">Administrator</option>
                              <option value="MEMBER">Member (Contributor)</option>
                              <option value="VIEWER">Viewer (Read-Only)</option>
                            </select>
                            {isUpdating && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-blue absolute -right-5 top-1.5" />
                            )}
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded border font-semibold text-xs ${config.badgeBg} ${config.badgeText} ${config.border}`}
                          >
                            {config.name}
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

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <AddMemberModal
          availableUsers={availableUsers}
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
        <PermissionsMatrixModal onClose={() => setIsMatrixModalOpen(false)} />
      )}
    </div>
  );
}

// Sub-Component: Add Member Modal
function AddMemberModal({
  availableUsers,
  projectId,
  onClose,
  onMemberAdded,
}: {
  availableUsers: User[];
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

    const res = await addProjectMember(projectId, selectedUserId, selectedRole);
    setIsSubmitting(false);

    if (res.success && res.member) {
      onMemberAdded(res.member as ProjectMember);
    } else {
      setErrorMessage(res.error || "Failed to add member to project.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-jira-gray-200">
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
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                className="w-full border border-jira-gray-300 rounded p-2 text-jira-navy font-medium outline-none focus:border-jira-blue"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-jira-gray-700 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                Project Role
              </label>
              <div className="space-y-2">
                {(["ADMIN", "MEMBER", "VIEWER"] as ProjectRole[]).map((role) => {
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
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`}
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
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-jira-gray-200">
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

// Sub-Component: Permissions Matrix Modal
function PermissionsMatrixModal({ onClose }: { onClose: () => void }) {
  const roles: ProjectRole[] = ["ADMIN", "MEMBER", "VIEWER"];
  const permissions = Object.entries(PERMISSION_DESCRIPTIONS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl border border-jira-gray-300 p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-jira-blue" />
            <div>
              <h2 className="text-base font-bold text-jira-navy">Permissions Scheme Matrix</h2>
              <p className="text-xs text-jira-gray-500">
                Detailed access breakdown by project role
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

        <div className="overflow-y-auto flex-1 border border-jira-gray-200 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-jira-gray-100 border-b border-jira-gray-200 font-bold text-[11px] text-jira-navy sticky top-0 z-10">
                <th className="px-4 py-3">Permission Category & Action</th>
                <th className="px-3 py-3 text-center w-24">Administrator</th>
                <th className="px-3 py-3 text-center w-24">Member</th>
                <th className="px-3 py-3 text-center w-24">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jira-gray-100">
              {permissions.map(([permKey, permMeta]) => {
                return (
                  <tr key={permKey} className="hover:bg-jira-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-jira-navy">{permMeta.label}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-jira-gray-100 text-jira-gray-600">
                          {permMeta.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-jira-gray-500 mt-0.5">
                        {permMeta.description}
                      </p>
                    </td>

                    {roles.map((role) => {
                      const isAllowed = ROLE_PERMISSIONS[role].includes(permKey as any);
                      return (
                        <td key={role} className="px-3 py-2.5 text-center">
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
