"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types";
import { createProject } from "@/lib/actions/projects";
import { useCurrentUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import { X, FolderPlus, Loader2, ShieldAlert } from "lucide-react";

interface CreateProjectModalProps {
  users: User[];
  onClose: () => void;
  onProjectCreated?: (newProj: any) => void;
}

export default function CreateProjectModal({
  users,
  onClose,
  onProjectCreated,
}: CreateProjectModalProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const modKey = useModKeyLabel();
  const canCreate = !currentUser || !!currentUser.canCreateProjects;
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState(users.length > 0 ? users[0].id : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate key from name if not manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyManuallyEdited) {
      const generated = val
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase();
      setKey(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser && !currentUser.canCreateProjects) {
      setError("You do not have permission to create projects.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a project name.");
      return;
    }
    if (!key.trim() || key.trim().length < 2) {
      setError("Project key must be at least 2 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await createProject({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description,
      leadId: leadId || undefined,
    });

    setIsSubmitting(false);

    if (res.success && res.project) {
      if (onProjectCreated) onProjectCreated(res.project);
      onClose();
      router.push(`/projects/${res.project.key}/board`);
      router.refresh();
    } else {
      setError(res.error || "Failed to create project");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full h-full sm:h-auto max-w-lg rounded-none sm:rounded-lg shadow-2xl border-0 sm:border border-jira-gray-300 flex flex-col max-h-none sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-jira-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-jira-blue-light text-jira-blue flex items-center justify-center font-bold">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-jira-navy">Create Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-500 hover:text-jira-navy p-1 rounded-md hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="p-4 sm:p-6 space-y-4 text-sm overflow-y-auto flex-1">
          {!canCreate && (
            <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You do not have permission to create projects. Please contact an administrator.</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Falcon AI Engine"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Project Key <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. FALCON"
              value={key}
              onChange={(e) => {
                setKeyManuallyEdited(true);
                setKey(e.target.value.toUpperCase());
              }}
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none font-mono uppercase text-jira-navy"
            />
            <p className="text-[11px] text-jira-gray-500 mt-1">
              Prefix used for all issues in this project (e.g., {key || "KEY"}-1, {key || "KEY"}-2).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Project Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full bg-white border border-jira-gray-300 rounded px-3 py-2 text-jira-navy focus:border-jira-blue outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="What is this project focused on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy leading-relaxed"
            />
          </div>

          <div className="pt-4 border-t border-jira-gray-200 flex items-center justify-end gap-3">
            <span className="text-[11px] text-jira-gray-400 hidden sm:inline mr-1">
              Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-jira-gray-100 border border-jira-gray-300 rounded text-jira-gray-600">{modKey}↵</kbd> to submit
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-jira-gray-700 hover:bg-jira-gray-100 rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canCreate}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white px-4 py-2 rounded font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
