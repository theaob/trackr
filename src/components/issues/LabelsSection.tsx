"use client";

import React, { useEffect, useRef, useState } from "react";
import { IssueLabel, Label } from "@/types";
import { addIssueLabel, getProjectLabels, removeIssueLabel } from "@/lib/actions/labels";
import { isValidLabelName, normalizeLabelName } from "@/lib/labels";
import { Tag as TagIcon, Plus, X } from "lucide-react";

interface LabelsSectionProps {
  issueId: string;
  projectId: string;
  labels?: IssueLabel[];
  canEdit: boolean;
  onLabelAdded: (issueLabel: IssueLabel) => void;
  onLabelRemoved: (labelId: string) => void;
}

export default function LabelsSection({
  issueId,
  projectId,
  labels = [],
  canEdit,
  onLabelAdded,
  onLabelRemoved,
}: LabelsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!adding) return;
    getProjectLabels(projectId).then(setProjectLabels as any);
  }, [adding, projectId]);

  const attachedNames = new Set(labels.map((l) => l.label.name));
  const suggestions = projectLabels
    .filter((l) => !attachedNames.has(l.name))
    .filter((l) => (input.trim() ? l.name.toLowerCase().includes(input.trim().toLowerCase()) : true))
    .slice(0, 8);

  const resetAddForm = () => {
    setAdding(false);
    setInput("");
    setError(null);
  };

  const submitLabel = async (rawName: string) => {
    const name = normalizeLabelName(rawName);
    if (!name) return;
    if (!isValidLabelName(name)) {
      setError("Labels can't contain spaces.");
      return;
    }
    if (attachedNames.has(name)) {
      setInput("");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await addIssueLabel(issueId, name);
    setSubmitting(false);
    if (res.success && res.issueLabel) {
      onLabelAdded(res.issueLabel as unknown as IssueLabel);
      setInput("");
      inputRef.current?.focus();
    } else {
      setError((res as { error?: string }).error || "Failed to add label.");
    }
  };

  const handleRemove = async (labelId: string) => {
    const res = await removeIssueLabel(issueId, labelId);
    if (res.success) onLabelRemoved(labelId);
  };

  if (labels.length === 0 && !canEdit) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-jira-blue" />
          <span>Labels{labels.length > 0 ? ` (${labels.length})` : ""}</span>
        </h3>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] text-jira-blue hover:underline font-semibold flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add label
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((issueLabel) => (
          <span
            key={issueLabel.id}
            className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jira-gray-100 border border-jira-gray-300 text-[11px] font-medium text-jira-gray-700"
          >
            {issueLabel.label.name}
            {canEdit && (
              <button
                onClick={() => handleRemove(issueLabel.labelId)}
                className="text-jira-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove label"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {labels.length === 0 && !adding && (
          <span className="text-xs text-jira-gray-500 italic">No labels.</span>
        )}
      </div>

      {adding && (
        <div className="mt-2 p-3 border border-jira-gray-300 rounded-md bg-jira-gray-50/70 space-y-2">
          {error && <div className="text-[11px] text-rose-600 font-medium">{error}</div>}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={input}
              disabled={submitting}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  submitLabel(input);
                } else if (e.key === "Escape") {
                  resetAddForm();
                }
              }}
              placeholder="Type a label and press Enter..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
            />
            <button
              onClick={resetAddForm}
              className="p-1.5 text-jira-gray-500 hover:text-jira-navy hover:bg-jira-gray-100 rounded shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="border border-jira-gray-200 rounded divide-y divide-jira-gray-100 max-h-40 overflow-y-auto bg-white">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => submitLabel(s.name)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-jira-gray-50 disabled:opacity-50 text-xs text-jira-navy"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
