"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types";
import { getAllUsers, updateUserProjectPermission } from "@/lib/actions/projects";
import UserAvatar from "@/components/common/UserAvatar";
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Shield,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react";

export default function UsersSettingsTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data as User[]);
    } catch {
      setMessage({ type: "error", text: "Failed to load users list." });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = async (user: User) => {
    const nextValue = !user.canCreateProjects;
    setUpdatingUserId(user.id);
    setMessage(null);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, canCreateProjects: nextValue } : u))
    );

    const result = await updateUserProjectPermission(user.id, nextValue);

    setUpdatingUserId(null);

    if (result.success) {
      setMessage({
        type: "success",
        text: `Project creation permission ${nextValue ? "granted to" : "revoked from"} ${user.name}.`,
      });
    } else {
      // Revert optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, canCreateProjects: !nextValue } : u))
      );
      setMessage({
        type: "error",
        text: result.error || "Failed to update user permission.",
      });
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  const creatorsCount = users.filter((u) => !!u.canCreateProjects).length;

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="bg-white border border-jira-gray-200 rounded-lg p-5 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-jira-blue-light text-jira-blue flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-jira-navy">Project Creation Permissions</h2>
            <p className="text-xs text-jira-gray-600 mt-1 leading-relaxed">
              Control which team members have permission to initialize new projects and boards in Trackr.
              Users without this permission will not see project creation buttons and cannot call project creation APIs.
            </p>

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-jira-gray-100 text-xs">
              <span className="text-jira-gray-500">
                Total Users: <strong className="text-jira-navy font-semibold">{users.length}</strong>
              </span>
              <span className="text-jira-gray-300">•</span>
              <span className="text-jira-gray-500">
                Allowed Creators:{" "}
                <strong className="text-emerald-700 font-semibold">{creatorsCount}</strong>
              </span>
              <span className="text-jira-gray-300">•</span>
              <span className="text-jira-gray-500">
                Restricted:{" "}
                <strong className="text-jira-gray-700 font-semibold">
                  {users.length - creatorsCount}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 animate-in fade-in ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-jira-gray-300 rounded-md focus:border-jira-blue focus:ring-1 focus:ring-jira-blue outline-none transition-all placeholder:text-jira-gray-400"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white border border-jira-gray-200 rounded-lg overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-jira-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-jira-gray-500">
            <Users className="w-8 h-8 text-jira-gray-300 mx-auto mb-2" />
            <p>No users matched your query.</p>
          </div>
        ) : (
          <div className="divide-y divide-jira-gray-100">
            <div className="bg-jira-gray-50/70 px-4 py-2.5 grid grid-cols-12 text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wider">
              <span className="col-span-5 sm:col-span-4">User</span>
              <span className="col-span-3 sm:col-span-3">Role</span>
              <span className="col-span-4 sm:col-span-5 text-right">Project Creation Permission</span>
            </div>

            {filteredUsers.map((user) => {
              const isUpdating = updatingUserId === user.id;
              const hasPerm = !!user.canCreateProjects;

              return (
                <div
                  key={user.id}
                  className="px-4 py-3.5 grid grid-cols-12 items-center hover:bg-jira-gray-50/50 transition-colors"
                >
                  {/* User info */}
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0 pr-2">
                    <UserAvatar user={user} size="md" />
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs font-semibold text-jira-navy truncate">
                        {user.name}
                      </div>
                      {user.email && (
                        <div className="text-[11px] text-jira-gray-500 truncate">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <div className="col-span-3 sm:col-span-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-jira-gray-100 text-jira-gray-700 border border-jira-gray-200">
                      {user.role || "Member"}
                    </span>
                  </div>

                  {/* Toggle permission */}
                  <div className="col-span-4 sm:col-span-5 flex items-center justify-end gap-2.5">
                    <span
                      className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium ${
                        hasPerm ? "text-emerald-700" : "text-jira-gray-500"
                      }`}
                    >
                      {hasPerm ? (
                        <>
                          <Unlock className="w-3 h-3 text-emerald-600" />
                          <span>Allowed</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-jira-gray-400" />
                          <span>Restricted</span>
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleTogglePermission(user)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-jira-blue focus:ring-offset-1 disabled:opacity-50 ${
                        hasPerm ? "bg-emerald-600" : "bg-jira-gray-300"
                      }`}
                      role="switch"
                      aria-checked={hasPerm}
                      title={hasPerm ? "Click to revoke permission" : "Click to grant permission"}
                    >
                      <span className="sr-only">Toggle project creation permission</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          hasPerm ? "translate-x-4" : "translate-x-0"
                        } flex items-center justify-center`}
                      >
                        {isUpdating && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-jira-blue" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
