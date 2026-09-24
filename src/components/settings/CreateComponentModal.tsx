"use client";

import React, { useState } from "react";
import { Component, User } from "@/types";
import { createComponent } from "@/lib/actions/components";
import { X, Boxes, Loader2 } from "lucide-react";

interface CreateComponentModalProps {
  projectId: string;
  members: User[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: (component: Component) => void;
}

export default function CreateComponentModal({
  projectId,
  members,
  isOpen,
  onClose,
  onCreated,
}: CreateComponentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setName("");
    setDescription("");
    setLeadId("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a component name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await createComponent({
      projectId,
      name: name.trim(),
      description: description.trim() || undefined,
      leadId: leadId || undefined,
    });

    setIsSubmitting(false);
    if (res.success && res.component) {
      onCreated(res.component as unknown as Component);
      handleClose();
    } else {
      setError((res as { error?: string }).error || "Failed to create component");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-none sm:rounded-lg shadow-xl border-0 sm:border border-jira-gray-200 w-full h-full sm:h-auto max-w-md overflow-hidden flex flex-col max-h-none sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-jira-blue" />
            <h2 className="text-base font-bold text-jira-navy">Create Component</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-jira-gray-500 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Component Name <span className="text-jira-red">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Backend API, Mobile App, Infrastructure"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="What this part of the project covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Component Lead (Optional)
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue"
            >
              <option value="">None</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-jira-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-medium px-4 py-2 rounded text-jira-gray-700 hover:bg-jira-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold px-4 py-2 rounded bg-jira-blue text-white hover:bg-jira-blue-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Component
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
