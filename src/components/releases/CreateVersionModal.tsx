"use client";

import React, { useState, useEffect } from "react";
import { Version } from "@/types";
import { createVersion, updateVersion } from "@/lib/actions/versions";
import { X, Calendar, Tag, FileText, Loader2 } from "lucide-react";

interface CreateVersionModalProps {
  projectId: string;
  version?: Version | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (version: Version) => void;
}

export default function CreateVersionModal({
  projectId,
  version,
  isOpen,
  onClose,
  onSaved,
}: CreateVersionModalProps) {
  const isEditing = Boolean(version);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (version) {
      setName(version.name);
      setDescription(version.description || "");
      setStartDate(
        version.startDate ? new Date(version.startDate).toISOString().split("T")[0] : ""
      );
      setReleaseDate(
        version.releaseDate ? new Date(version.releaseDate).toISOString().split("T")[0] : ""
      );
    } else {
      setName("");
      setDescription("");
      setStartDate("");
      setReleaseDate("");
    }
    setError(null);
  }, [version, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Version name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && version) {
        const res = await updateVersion(version.id, {
          name,
          description: description || null,
          startDate: startDate || null,
          releaseDate: releaseDate || null,
        });

        if (res.success && res.version) {
          onSaved(res.version as unknown as Version);
          onClose();
        } else {
          setError(res.error || "Failed to update version");
        }
      } else {
        const res = await createVersion({
          projectId,
          name,
          description,
          startDate: startDate || null,
          releaseDate: releaseDate || null,
        });

        if (res.success && res.version) {
          onSaved(res.version as unknown as Version);
          onClose();
        } else {
          setError(res.error || "Failed to create version");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-jira-gray-200 w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-jira-blue" />
            <h2 className="text-base font-bold text-jira-navy">
              {isEditing ? "Edit Version" : "Create Version"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-500 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
              {error}
            </div>
          )}

          {/* Version Name */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Version Name <span className="text-jira-red">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 1.0.0 or 2026.Q4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue focus:ring-1 focus:ring-jira-blue outline-none"
              autoFocus
              required
            />
          </div>

          {/* Dates: Start & Release */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
                Release Date
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-jira-gray-500" />
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Brief summary of goals or theme for this release..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-jira-gray-200">
            <button
              type="button"
              onClick={onClose}
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
              {isEditing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
