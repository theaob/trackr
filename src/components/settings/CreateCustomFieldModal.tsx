"use client";

import React, { useState } from "react";
import { CustomField, CustomFieldType } from "@/types";
import { createCustomField } from "@/lib/actions/customFields";
import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { CustomFieldIcon } from "@/components/common/CustomFieldRenderer";

interface CreateCustomFieldModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (field: CustomField) => void;
}

const FIELD_TYPES: { type: CustomFieldType; label: string; description: string }[] = [
  { type: "TEXT", label: "Short text", description: "One line: an identifier, a short note or a name" },
  { type: "NUMBER", label: "Number", description: "A metric, estimated hours or a size" },
  { type: "SELECT", label: "Single choice", description: "One option from a list you set" },
  { type: "MULTI_SELECT", label: "Multiple choice", description: "Any number of options from a list you set" },
  { type: "CHECKBOX", label: "Checkbox", description: "Yes or no, such as Regression or Customer impact" },
  { type: "DATE", label: "Date", description: "A deadline, target or milestone" },
  { type: "URL", label: "Link", description: "A link to docs, a dashboard or a pull request" },
];

export default function CreateCustomFieldModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
}: CreateCustomFieldModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [options, setOptions] = useState<string[]>(["Production", "Staging", "QA"]);
  const [newOptionInput, setNewOptionInput] = useState("");
  const [required, setRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionInput.trim()) return;
    if (!options.includes(newOptionInput.trim())) {
      setOptions([...options, newOptionInput.trim()]);
    }
    setNewOptionInput("");
  };

  const handleRemoveOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a field name");
      return;
    }

    if ((type === "SELECT" || type === "MULTI_SELECT") && options.length === 0) {
      setError("Please add at least one dropdown option");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createCustomField({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        options: type === "SELECT" || type === "MULTI_SELECT" ? options : undefined,
        required,
      });

      if (res.success) {
        onCreated(res.field as unknown as CustomField);
        onClose();
      } else {
        setError(res.error || "Failed to create custom field");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOptions = type === "SELECT" || type === "MULTI_SELECT";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Create custom field"
        description="A field every issue in this project gets, shown with its other properties."
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="custom-field-form" variant="primary" loading={isSubmitting}>
              Create field
            </Button>
          </>
        }
      >
        <form id="custom-field-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Field label="Name" required>
            <Input placeholder="Environment, Customer tier, Estimated hours" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Description" hint="Shown under the field, to say what it's for.">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select
              value={type}
              onChange={(v) => setType(v as CustomFieldType)}
              options={FIELD_TYPES.map((ft) => ({
                value: ft.type,
                label: ft.label,
                description: ft.description,
                icon: <CustomFieldIcon type={ft.type} className="h-4 w-4 text-muted" />,
              }))}
            />
          </Field>

          {hasOptions && (
            <fieldset className="space-y-2 rounded-control border border-subtle p-3">
              <legend className="px-1 text-xs font-medium text-ink-2">Options</legend>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="New option"
                  placeholder="Type an option, then Add"
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption(e);
                    }
                  }}
                />
                <Button onClick={handleAddOption}>Add</Button>
              </div>
              {options.length > 0 && (
                <ul aria-label="Options" className="flex flex-wrap gap-1.5">
                  {options.map((opt, idx) => (
                    <li
                      key={opt}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-subtle bg-surface pl-2.5 pr-1 text-xs text-ink"
                    >
                      {opt}
                      <button
                        type="button"
                        aria-label={`Remove ${opt}`}
                        onClick={() => handleRemoveOption(idx)}
                        className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-surface-sunk hover:text-danger"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          <Checkbox label="Required: every issue must have a value" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
