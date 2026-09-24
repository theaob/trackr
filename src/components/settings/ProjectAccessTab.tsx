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
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
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
  Users,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Crown,
  Info,
  Loader2,
  UserPlus,
  SlidersHorizontal,
  Edit2,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

// The chart palette's hues, so role colours match the rest of the app.
const PRESET_ROLE_COLORS = [
  { name: "Blue", hex: "#2a78d6" },
  { name: "Orange", hex: "#eb6834" },
  { name: "Aqua", hex: "#1baf7a" },
  { name: "Yellow", hex: "#eda100" },
  { name: "Pink", hex: "#e87ba4" },
  { name: "Green", hex: "#008300" },
  { name: "Violet", hex: "#4a3aa7" },
  { name: "Red", hex: "#e34948" },
];

interface ProjectAccessTabProps {
  project: Project;
  /** Which part of access this shows: the people, or the roles they can have. */
  section: "members" | "roles";
  initialMembers: ProjectMember[];
  initialCustomRoles?: CustomRole[];
  allOrgUsers: User[];
  currentUserRole: ProjectRole | null;
  isProjectLead: boolean;
  /** Keeps the settings page's member list in step, for the other sections. */
  onMembersChange?: (members: ProjectMember[]) => void;
}

const BUILT_IN: BuiltInRole[] = ["ADMIN", "MEMBER", "VIEWER"];
const BUILT_IN_TOKEN: Record<BuiltInRole, string | undefined> = { ADMIN: "accent", MEMBER: "success", VIEWER: undefined };

function parsePermissions(role: CustomRole): ProjectPermission[] {
  return Array.isArray(role.permissions) ? role.permissions : (JSON.parse((role.permissions as unknown as string) || "[]") as ProjectPermission[]);
}

/** A role as a lozenge: built-in roles in theme colours, custom roles in their own. */
export function RoleLozenge({ role, customRoles }: { role: ProjectRole; customRoles: CustomRole[] }) {
  const config = getRoleBadgeConfig(role, customRoles);
  if (BUILT_IN.includes(role as BuiltInRole)) return <StatusLozenge label={config.name} token={BUILT_IN_TOKEN[role as BuiltInRole]} />;
  return <StatusLozenge label={config.name} color={config.color} />;
}

/**
 * Project access, as the settings page's Members and Roles sections: one
 * table each, edited in place.
 */
export default function ProjectAccessTab({
  project,
  section,
  initialMembers,
  initialCustomRoles = [],
  allOrgUsers,
  currentUserRole,
  isProjectLead,
  onMembersChange,
}: ProjectAccessTabProps) {
  const { toast } = useToast();
  const [members, setMembersState] = useState<ProjectMember[]>(initialMembers);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(initialCustomRoles);
  const [query, setQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = currentUserRole === "ADMIN" || isProjectLead;
  const setMembers = (update: (prev: ProjectMember[]) => ProjectMember[]) => {
    setMembersState((prev) => {
      const next = update(prev);
      onMembersChange?.(next);
      return next;
    });
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.user.name, m.user.email ?? "", m.user.role ?? "", getRoleBadgeConfig(m.role, customRoles).name].some((v) => v.toLowerCase().includes(q))
    );
  }, [members, query, customRoles]);

  const availableUsers = useMemo(() => {
    const ids = new Set(members.map((m) => m.userId));
    return allOrgUsers.filter((u) => !ids.has(u.id));
  }, [allOrgUsers, members]);

  const roleOptions = [
    ...BUILT_IN.map((r) => ({ value: r, label: ROLE_CONFIG[r].name, description: "Built in" })),
    ...customRoles.map((r) => ({ value: r.name, label: r.name, description: r.description || "Custom role" })),
  ];
  const countFor = (role: string, id?: string) => members.filter((m) => m.role === role || (id && m.customRoleId === id)).length;

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    const custom = customRoles.find((r) => r.name === newRole || r.id === newRole);
    const res = await updateProjectMemberRole(project.id, userId, custom ? custom.name : (newRole as ProjectRole), custom ? custom.id : null);
    setUpdatingUserId(null);
    if (res.success && res.member) {
      setMembers((prev) => prev.map((m) => (m.userId === userId ? (res.member as ProjectMember) : m)));
    } else {
      toast({ title: res.error || "Couldn't change the role", tone: "danger" });
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    const res = await removeProjectMember(project.id, removing.userId);
    setBusy(false);
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.userId !== removing.userId));
      toast({ title: `${removing.user.name} removed`, tone: "success" });
      setRemoving(null);
    } else {
      toast({ title: res.error || "Couldn't remove them", tone: "danger" });
    }
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    const role = deletingRole;
    setBusy(true);
    const res = await deleteCustomRole(role.id, "MEMBER");
    setBusy(false);
    if (res.success) {
      setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
      setMembers((prev) =>
        prev.map((m) => (m.customRoleId === role.id || m.role === role.name ? { ...m, role: "MEMBER", customRoleId: null, customRole: null } : m))
      );
      toast({ title: `${role.name} deleted`, tone: "success" });
      setDeletingRole(null);
    } else {
      toast({ title: res.error || "Couldn't delete the role", tone: "danger" });
    }
  };

  const th = "h-9 border-b border-subtle px-3 text-left text-xs font-medium text-ink-2";
  const td = "border-b border-subtle px-3 py-2 text-[13px] text-ink";

  return (
    <div className="space-y-4">
      {section === "members" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search members"
                placeholder="Search by name, email or role"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full rounded-control border border-subtle bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
              />
            </div>
            {canManage && (
              <Button variant="primary" onClick={() => setIsAddModalOpen(true)} disabled={availableUsers.length === 0}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add member
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-card border border-subtle bg-surface">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <caption className="sr-only">Project members</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Name
                  </th>
                  <th scope="col" className={cn(th, "w-40")}>
                    Job title
                  </th>
                  <th scope="col" className={cn(th, "w-56")}>
                    Role
                  </th>
                  <th scope="col" className={cn(th, "w-28")}>
                    Joined
                  </th>
                  <th scope="col" className={cn(th, "w-12")}>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted">
                      {query ? "No members match." : "No members yet."}
                    </td>
                  </tr>
                ) : (
                  shown.map((m) => {
                    const isLead = m.userId === project.leadId;
                    return (
                      <tr key={m.id} className="hover:bg-surface-sunk/60">
                        <td className={td}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar user={m.user} size="sm" />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span className="truncate">{m.user.name}</span>
                                {isLead && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 text-[11px] font-medium text-warning">
                                    <Crown className="h-3 w-3" aria-hidden="true" />
                                    Lead
                                  </span>
                                )}
                              </span>
                              {m.user.email && <span className="block truncate text-xs text-muted">{m.user.email}</span>}
                            </span>
                          </span>
                        </td>
                        <td className={cn(td, "text-ink-2")}>{m.user.role || "–"}</td>
                        <td className={td}>
                          {canManage && !isLead ? (
                            <span className="flex items-center gap-2">
                              <Select
                                aria-label={`Role for ${m.user.name}`}
                                className="w-48"
                                value={m.role}
                                disabled={updatingUserId === m.userId}
                                onChange={(v) => v !== m.role && handleRoleChange(m.userId, v)}
                                options={roleOptions}
                              />
                              {updatingUserId === m.userId && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-label="Saving" />}
                            </span>
                          ) : (
                            <RoleLozenge role={m.role} customRoles={customRoles} />
                          )}
                        </td>
                        <td className={cn(td, "text-xs text-ink-2")}>{m.createdAt ? format(new Date(m.createdAt), "MMM d, yyyy") : "–"}</td>
                        <td className={cn(td, "text-right")}>
                          {canManage && !isLead && (
                            <IconButton label={`Remove ${m.user.name} from the project`} icon={<Trash2 aria-hidden="true" />} size="sm" onClick={() => setRemoving(m)} />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs text-muted">
              A role decides what its members can do. The three built-in roles can&rsquo;t be changed; add your own for anything in between.
            </p>
            <span className="flex items-center gap-2">
              <Button onClick={() => setIsMatrixModalOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Compare permissions
              </Button>
              {canManage && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingRole(null);
                    setIsRoleModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create role
                </Button>
              )}
            </span>
          </div>
          <div className="overflow-x-auto rounded-card border border-subtle bg-surface">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <caption className="sr-only">Project roles</caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "w-52")}>
                    Role
                  </th>
                  <th scope="col" className={th}>
                    What it can do
                  </th>
                  <th scope="col" className={cn(th, "w-28 text-right")}>
                    Permissions
                  </th>
                  <th scope="col" className={cn(th, "w-24 text-right")}>
                    Members
                  </th>
                  <th scope="col" className={cn(th, "w-24")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {BUILT_IN.map((r) => (
                  <tr key={r} className="hover:bg-surface-sunk/60">
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <RoleLozenge role={r} customRoles={customRoles} />
                        <Lock className="h-3.5 w-3.5 text-muted" aria-label="Built in" />
                      </span>
                    </td>
                    <td className={cn(td, "text-xs text-ink-2")}>{ROLE_CONFIG[r].description}</td>
                    <td className={cn(td, "text-right tabular-nums text-ink-2")}>{ROLE_PERMISSIONS[r].length}</td>
                    <td className={cn(td, "text-right tabular-nums text-ink-2")}>{countFor(r)}</td>
                    <td className={td} />
                  </tr>
                ))}
                {customRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-surface-sunk/60">
                    <td className={td}>
                      <RoleLozenge role={role.name} customRoles={customRoles} />
                    </td>
                    <td className={cn(td, "text-xs text-ink-2")}>
                      {role.description || <span className="text-muted">No description</span>}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {parsePermissions(role).map((p) => (
                          <span key={p} title={PERMISSION_DESCRIPTIONS[p]?.description} className="rounded-full bg-surface-sunk px-1.5 text-[11px] text-ink-2">
                            {PERMISSION_DESCRIPTIONS[p]?.label || p}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className={cn(td, "text-right tabular-nums text-ink-2")}>{parsePermissions(role).length}</td>
                    <td className={cn(td, "text-right tabular-nums text-ink-2")}>{countFor(role.name, role.id)}</td>
                    <td className={cn(td, "text-right")}>
                      {canManage && (
                        <span className="inline-flex items-center gap-0.5">
                          <IconButton
                            size="sm"
                            label={`Edit ${role.name}`}
                            icon={<Edit2 aria-hidden="true" />}
                            onClick={() => {
                              setEditingRole(role);
                              setIsRoleModalOpen(true);
                            }}
                          />
                          <IconButton size="sm" label={`Delete ${role.name}`} icon={<Trash2 aria-hidden="true" />} onClick={() => setDeletingRole(role)} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {customRoles.length === 0 && <p className="text-xs text-muted">No custom roles yet. A &ldquo;QA tester&rdquo; or &ldquo;Contractor&rdquo; role is a common start.</p>}
        </>
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent
            size="sm"
            title={`Remove ${removing.user.name}?`}
            description="They lose access to this project. Their issues and comments stay."
            footer={
              <>
                <Button onClick={() => setRemoving(null)}>Cancel</Button>
                <Button variant="danger" loading={busy} onClick={confirmRemove}>
                  Remove
                </Button>
              </>
            }
          />
        )}
      </Dialog>

      <Dialog open={deletingRole !== null} onOpenChange={(open) => !open && setDeletingRole(null)}>
        {deletingRole && (
          <DialogContent
            size="sm"
            title={`Delete the ${deletingRole.name} role?`}
            description={
              countFor(deletingRole.name, deletingRole.id) > 0
                ? `Its ${countFor(deletingRole.name, deletingRole.id)} member(s) become Members.`
                : "Nobody has this role."
            }
            footer={
              <>
                <Button onClick={() => setDeletingRole(null)}>Cancel</Button>
                <Button variant="danger" loading={busy} onClick={confirmDeleteRole}>
                  Delete role
                </Button>
              </>
            }
          />
        )}
      </Dialog>

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

      {isMatrixModalOpen && <PermissionsMatrixModal customRoles={customRoles} onClose={() => setIsMatrixModalOpen(false)} />}

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
            ...customRoles.filter((r) => !editingRole || r.id !== editingRole.id).map((r) => r.name.toLowerCase()),
          ]}
          onClose={() => {
            setIsRoleModalOpen(false);
            setEditingRole(null);
          }}
          onSaved={(savedRole, isNew) => {
            if (isNew) {
              setCustomRoles((prev) => [...prev, savedRole]);
            } else {
              setCustomRoles((prev) => prev.map((r) => (r.id === savedRole.id ? savedRole : r)));
              setMembers((prev) => prev.map((m) => (m.customRoleId === savedRole.id ? { ...m, role: savedRole.name, customRole: savedRole } : m)));
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
      <div className="bg-surface w-full max-w-lg rounded-lg shadow-2xl border border-subtle p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-ink">Add Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {availableUsers.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <Users className="w-8 h-8 text-muted mx-auto" />
            <p className="text-xs text-ink-2 font-medium">
              All organization users are already members of this project!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1">
            {errorMessage && (
              <div className="p-2.5 rounded bg-danger-soft border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                Teammate
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-subtle rounded p-2 text-ink font-medium focus:border-accent"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px]">
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
                          ? "bg-accent-soft/30 border-accent"
                          : "border-subtle hover:bg-page"
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectRole"
                        checked={selectedRole === role}
                        onChange={() => setSelectedRole(role)}
                        className="mt-0.5 text-accent"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{cfg.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-px rounded border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`}
                          >
                            {role}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-2 mt-0.5">
                          {cfg.description}
                        </p>
                      </div>
                    </label>
                  );
                })}

                {/* Custom Roles (if any) */}
                {customRoles.map((cr) => {
                  const color = cr.color || "#2a78d6";
                  return (
                    <label
                      key={cr.id}
                      onClick={() => setSelectedRole(cr.name)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRole === cr.name
                          ? "bg-accent-soft/30 border-accent"
                          : "border-subtle hover:bg-page"
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectRole"
                        checked={selectedRole === cr.name}
                        onChange={() => setSelectedRole(cr.name)}
                        className="mt-0.5 text-accent"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{cr.name}</span>
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
                        <p className="text-[11px] text-ink-2 mt-0.5">
                          {cr.description || "Custom project role with tailored permissions."}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-subtle shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-ink-2 hover:bg-surface-sunk rounded font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent hover:bg-accent-hover text-accent-fg px-4 py-2 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
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
  const [color, setColor] = useState(existingRole?.color || "#2a78d6");

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
      <div className="bg-surface w-full max-w-2xl rounded-lg shadow-2xl border border-subtle p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-base font-bold text-ink">
                {isEditing ? "Edit Custom Role" : "Create Custom Project Role"}
              </h2>
              <p className="text-xs text-muted">
                Configure role details, branding color, and fine-grained permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {errorMessage && (
            <div className="p-2.5 rounded bg-danger-soft border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px] mb-1">
                Role Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. QA Specialist, Release Manager, Contractor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-subtle rounded text-ink font-semibold focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px] mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 p-0.5 rounded border border-subtle cursor-pointer bg-surface"
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
                          ? "scale-125 border-ink shadow-xs"
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
            <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px] mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Explain the scope and responsibilities of this role..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-subtle rounded text-ink focus:border-accent"
            />
          </div>

          {/* Permissions Checklist */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-subtle">
              <label className="block text-ink-2 font-bold uppercase tracking-wider text-[10px]">
                Permissions Scheme ({selectedPermissions.size} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted">•</span>
                <button
                  type="button"
                  onClick={clearOptional}
                  className="text-[11px] font-semibold text-ink-2 hover:text-ink hover:underline"
                >
                  Clear Optional
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {permissionCategories.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <div className="text-[11px] font-bold text-ink bg-page px-2 py-1 rounded border border-subtle">
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
                              ? "bg-accent-soft/40 border-accent/60"
                              : "border-subtle hover:bg-page/70"
                          } ${isMandatory ? "opacity-90 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={isMandatory}
                            checked={isChecked}
                            onChange={() => togglePermission(permKey)}
                            className="mt-0.5 rounded text-accent focus:ring-accent"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink">{permMeta.label}</span>
                              {isMandatory && (
                                <span className="text-[9px] font-bold px-1 rounded bg-warning-soft text-warning">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted leading-tight mt-0.5">
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
          <div className="flex justify-end gap-2.5 pt-3 border-t border-subtle shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-2 hover:bg-surface-sunk rounded font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent hover:bg-accent-hover text-accent-fg px-4 py-2 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
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
      <div className="bg-surface w-full max-w-4xl rounded-lg shadow-2xl border border-subtle p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-base font-bold text-ink">Permissions Scheme Matrix</h2>
              <p className="text-xs text-muted">
                Detailed access breakdown across standard system roles and custom project roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto flex-1 border border-subtle rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-surface-sunk border-b border-subtle font-bold text-[11px] text-ink sticky top-0 z-10">
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
                        style={{ backgroundColor: cr.color || "#2a78d6" }}
                      />
                      <span>{cr.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {permissions.map(([permKey, permMeta]) => {
                return (
                  <tr key={permKey} className="hover:bg-page/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{permMeta.label}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-px rounded bg-surface-sunk text-ink-2">
                          {permMeta.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {permMeta.description}
                      </p>
                    </td>

                    {/* Built-in roles */}
                    {builtInRoles.map(({ key }) => {
                      const isAllowed = ROLE_PERMISSIONS[key]?.includes(permKey as ProjectPermission);
                      return (
                        <td key={key} className="px-3 py-2.5 text-center">
                          {isAllowed ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success-soft text-success">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-sunk text-muted">
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
                                backgroundColor: `${cr.color || "#2a78d6"}20`,
                                color: cr.color || "#2a78d6",
                              }}
                            >
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-sunk text-muted">
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
            className="px-4 py-2 bg-surface-sunk hover:bg-subtle text-ink font-semibold text-xs rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
