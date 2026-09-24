"use client";

import React, { useEffect, useState } from "react";
import { Component, IssueComponent } from "@/types";
import { addIssueComponent, getProjectComponents, removeIssueComponent } from "@/lib/actions/components";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();
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
      toast({ title: "Couldn't add the component", description: (res as { error?: string }).error, tone: "danger" });
    }
  };

  const handleRemove = async (componentId: string) => {
    const target = components.find((c) => c.componentId === componentId);
    onComponentRemoved(componentId);

    const res = await removeIssueComponent(issueId, componentId);
    if (!res.success) {
      if (target) onComponentAdded(target);
      toast({ title: "Couldn't remove the component", description: (res as { error?: string }).error, tone: "danger" });
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {components.map((issueComponent) => (
          <span
            key={issueComponent.id}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-subtle bg-surface-sunk px-2 text-xs text-ink"
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
                aria-label={`Remove component ${issueComponent.component.name}`}
                className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-danger"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}

        {components.length === 0 && !canEdit && <span className="text-[13px] text-muted">None</span>}

        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-6 items-center gap-1 rounded-control px-1.5 text-xs text-ink-2 hover:bg-surface-sunk hover:text-ink"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {components.length === 0 ? "Add component" : "Add"}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-col gap-1.5">
          {!loaded ? (
            <p className="text-xs text-ink-2">Loading components…</p>
          ) : available.length > 0 ? (
            <ul className="max-h-36 overflow-y-auto rounded-control border border-subtle bg-surface p-1">
              {available.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={submittingId === c.id}
                    onClick={() => handleAdd(c.id)}
                    className="flex h-7 w-full items-center justify-between gap-2 rounded-[4px] px-2 text-left text-xs text-ink hover:bg-surface-sunk disabled:opacity-50"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.lead && <span className="shrink-0 text-[11px] text-ink-2">{c.lead.name}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-2">
              {projectComponents.length === 0
                ? "This project has no components yet. Add some in Project settings → Components."
                : "All components are already added."}
            </p>
          )}
          <button type="button" onClick={() => setAdding(false)} className="self-start text-xs font-medium text-accent hover:underline">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
