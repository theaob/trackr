"use client";

import React, { useEffect, useState } from "react";
import { Component, IssueComponent } from "@/types";
import { addIssueComponent, getProjectComponents, removeIssueComponent } from "@/lib/actions/components";
import { Boxes, Plus, X } from "lucide-react";

interface ComponentsFieldProps {
  issueId: string;
  projectId: string;
  components?: IssueComponent[];
  canEdit: boolean;
  onComponentAdded: (issueComponent: IssueComponent) => void;
  onComponentRemoved: (componentId: string) => void;
}

export default function ComponentsField({
  issueId,
  projectId,
  components = [],
  canEdit,
  onComponentAdded,
  onComponentRemoved,
}: ComponentsFieldProps) {
  const [adding, setAdding] = useState(false);
  const [projectComponents, setProjectComponents] = useState<Component[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) return;
    getProjectComponents(projectId).then((list) => {
      setProjectComponents(list as unknown as Component[]);
      setLoaded(true);
    });
  }, [adding, projectId]);

  const attachedIds = new Set(components.map((c) => c.componentId));
  const available = projectComponents.filter((c) => !attachedIds.has(c.id));

  const handleAdd = async (componentId: string) => {
    const comp = projectComponents.find((c) => c.id === componentId);
    if (!comp) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticComponent = {
      id: tempId,
      issueId,
      componentId,
      component: comp,
      createdAt: new Date(),
    };

    onComponentAdded(optimisticComponent as unknown as IssueComponent);
    setAdding(false);

    const res = await addIssueComponent(issueId, componentId);
    if (res.success && res.issueComponent) {
      onComponentRemoved(tempId);
      onComponentAdded(res.issueComponent as unknown as IssueComponent);
    } else {
      onComponentRemoved(tempId);
      alert((res as { error?: string }).error || "Failed to add component.");
    }
  };

  const handleRemove = async (componentId: string) => {
    const target = components.find((c) => c.componentId === componentId);
    onComponentRemoved(componentId);

    const res = await removeIssueComponent(issueId, componentId);
    if (!res.success) {
      if (target) onComponentAdded(target);
      alert((res as { error?: string }).error || "Failed to remove component.");
    }
  };

  if (components.length === 0 && !canEdit) return null;

  return (
    <div>
      <label className="block text-xs font-bold text-jira-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Boxes className="w-3 h-3 text-jira-blue" />
        Components
      </label>

      <div className="flex flex-wrap items-center gap-1.5">
        {components.map((issueComponent) => (
          <span
            key={issueComponent.id}
            className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jira-gray-100 border border-jira-gray-300 text-[11px] font-medium text-jira-gray-700"
            title={
              issueComponent.component.description ||
              (issueComponent.component.lead ? `Lead: ${issueComponent.component.lead.name}` : undefined)
            }
          >
            {issueComponent.component.name}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleRemove(issueComponent.componentId)}
                className="text-jira-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove component"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {components.length === 0 && !adding && (
          <span className="text-xs text-jira-gray-500 italic">None</span>
        )}

        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[11px] text-jira-blue hover:underline font-semibold flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 p-2.5 border border-jira-gray-300 rounded-md bg-jira-gray-50/70 space-y-1.5">
          {!loaded ? (
            <p className="text-[11px] text-jira-gray-500">Loading components…</p>
          ) : available.length > 0 ? (
            <div className="max-h-36 overflow-y-auto border border-jira-gray-200 rounded divide-y divide-jira-gray-100 bg-white">
              {available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={submittingId === c.id}
                  onClick={() => handleAdd(c.id)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-jira-gray-50 disabled:opacity-50 text-xs text-jira-navy"
                >
                  <span>{c.name}</span>
                  {c.lead && <span className="text-[10px] text-jira-gray-500">{c.lead.name}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-jira-gray-500">
              {projectComponents.length === 0
                ? "No components defined for this project yet. Add some in Project Settings → Components."
                : "All components are already attached."}
            </p>
          )}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-[11px] text-jira-gray-600 hover:text-jira-navy font-medium"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
