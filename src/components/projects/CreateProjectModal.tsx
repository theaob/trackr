"use client";

import React, { useState } from "react";
import { User } from "@/types";
import { createProject } from "@/lib/actions/projects";
import { useCurrentUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import SubmitShortcutHint from "@/components/common/SubmitShortcutHint";
import { ShieldAlert } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

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

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Create project"
        onKeyDown={handleFormKeyDown}
        footer={
          <>
            <SubmitShortcutHint className="mr-auto hidden sm:inline-flex" />
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="project-form" variant="primary" loading={isSubmitting} disabled={!canCreate}>
              Create project
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {!canCreate && (
            <p className="flex items-center gap-2 rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              You don&apos;t have permission to create projects. Ask an administrator.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Field label="Name" required>
            <Input placeholder="Falcon" value={name} onChange={(e) => handleNameChange(e.target.value)} autoFocus />
          </Field>
          <Field label="Key" required hint={`Starts every issue's ID: ${key || "KEY"}-1, ${key || "KEY"}-2.`}>
            <Input
              className="font-mono uppercase"
              placeholder="FALCON"
              maxLength={10}
              value={key}
              onChange={(e) => {
                setKeyManuallyEdited(true);
                setKey(e.target.value.toUpperCase());
              }}
            />
          </Field>
          <Field label="Lead">
            <Select
              searchable
              searchPlaceholder="Find a person…"
              value={leadId}
              onChange={setLeadId}
              options={users.map((u) => ({ value: u.id, label: u.name, keywords: u.email, icon: <UserAvatar user={u} size="xs" /> }))}
            />
          </Field>
          <Field label="Description">
            <Textarea rows={3} placeholder="What the project is for" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
