"use client";

import React, { useEffect, useRef, useState } from "react";
import { IssueLabel, Label } from "@/types";
import { addIssueLabel, getProjectLabels, removeIssueLabel } from "@/lib/actions/labels";
import { isValidLabelName, normalizeLabelName } from "@/lib/labels";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();
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

    const tempId = `temp-${Date.now()}`;
    const optimisticLabel: IssueLabel = {
      id: tempId,
      issueId,
      labelId: tempId,
      label: {
        id: tempId,
        projectId,
        name,
        createdAt: new Date(),
      },
    };

    onLabelAdded(optimisticLabel);
    setInput("");
    setError(null);
    setAdding(false);

    const res = await addIssueLabel(issueId, name);
    if (res.success && res.issueLabel) {
      onLabelRemoved(tempId);
      onLabelAdded(res.issueLabel as unknown as IssueLabel);
    } else {
      onLabelRemoved(tempId);
      setInput(name);
      setAdding(true);
      setError((res as { error?: string }).error || "Failed to add label.");
    }
  };

  const handleRemove = async (labelId: string) => {
    const targetLabel = labels.find((l) => l.labelId === labelId || l.id === labelId);
    onLabelRemoved(labelId);

    const res = await removeIssueLabel(issueId, labelId);
    if (!res.success) {
      if (targetLabel) onLabelAdded(targetLabel);
      toast({ title: "Couldn't remove the label", description: (res as { error?: string }).error, tone: "danger" });
    }
  };

  const chip =
    "group inline-flex h-6 items-center gap-1 rounded-full border border-subtle bg-surface-sunk px-2 text-xs text-ink";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((issueLabel) => (
          <span key={issueLabel.id} className={chip}>
            {issueLabel.label.name}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleRemove(issueLabel.labelId)}
                aria-label={`Remove label ${issueLabel.label.name}`}
                className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-danger"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {labels.length === 0 && !canEdit && <span className="text-[13px] text-muted">None</span>}
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-6 items-center gap-1 rounded-control px-1.5 text-xs text-ink-2 hover:bg-surface-sunk hover:text-ink"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {labels.length === 0 ? "Add label" : "Add"}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-col gap-1.5">
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={input}
              disabled={submitting}
              aria-label="New label"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  submitLabel(input);
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  resetAddForm();
                }
              }}
              placeholder="Type a label, press Enter"
              className="h-7 min-w-0 flex-1 rounded-control border border-subtle bg-surface px-2 text-xs text-ink placeholder:text-muted focus:border-accent"
            />
            <button
              type="button"
              onClick={resetAddForm}
              aria-label="Stop adding labels"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-control border border-subtle bg-surface p-1">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitLabel(s.name)}
                    className="flex h-7 w-full items-center rounded-[4px] px-2 text-left text-xs text-ink hover:bg-surface-sunk disabled:opacity-50"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
