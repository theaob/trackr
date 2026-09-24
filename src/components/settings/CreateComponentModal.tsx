"use client";

import React, { useState } from "react";
import { Component, User } from "@/types";
import { createComponent } from "@/lib/actions/components";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        title="Create component"
        description="A component is a part of the project, such as the API or the mobile app, that issues can belong to."
        footer={
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" form="component-form" variant="primary" loading={isSubmitting}>
              Create component
            </Button>
          </>
        }
      >
        <form id="component-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Field label="Name" required>
            <Input placeholder="Backend API, Mobile app, Infrastructure" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Description">
            <Input placeholder="What this part of the project covers" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Lead">
            <Select
              value={leadId}
              onChange={setLeadId}
              options={[{ value: "", label: "None" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
