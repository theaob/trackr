"use client";

import React, { useState } from "react";
import { CustomField, CustomFieldType } from "@/types";
import { createCustomField } from "@/lib/actions/customFields";
import { X, Plus, Trash2, Sliders, Loader2 } from "lucide-react";
import { CustomFieldIcon } from "@/components/common/CustomFieldRenderer";

interface CreateCustomFieldModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (field: CustomField) => void;
}

const FIELD_TYPES: { type: CustomFieldType; label: string; description: string }[] = [
  { type: "TEXT", label: "Short Text", description: "Single-line text for identifiers, short notes, or names." },
  { type: "NUMBER", label: "Number", description: "Numeric value for metrics, estimated hours, or sizing." },
  { type: "SELECT", label: "Single Select Dropdown", description: "Choose one option from a predefined list." },
  { type: "MULTI_SELECT", label: "Multi-Select Choices", description: "Select multiple options from a predefined list." },
  { type: "CHECKBOX", label: "Checkbox / Toggle", description: "Boolean flag (e.g. Is Regression, Customer Impact)." },
  { type: "DATE", label: "Date Picker", description: "Calendar date for deadlines, targets, or milestones." },
  { type: "URL", label: "Web Link / URL", description: "Clickable URL linking to external docs, dashboards, or PRs." },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-none sm:rounded-lg shadow-xl border-0 sm:border border-jira-gray-200 w-full h-full sm:h-auto max-w-lg overflow-hidden flex flex-col max-h-none sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-jira-blue" />
            <h2 className="text-base font-bold text-jira-navy">Create Custom Field</h2>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-500 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
              {error}
            </div>
          )}

          {/* Field Name */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Field Name <span className="text-jira-red">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Environment, Customer Tier, Estimated Hours"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Help text explaining this field's purpose..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
            />
          </div>

          {/* Field Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1.5">
              Field Type
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-jira-gray-300 rounded-md p-2 bg-jira-gray-50">
              {FIELD_TYPES.map((ft) => (
                <label
                  key={ft.type}
                  className={`flex items-start gap-2.5 p-2 rounded cursor-pointer border transition-colors ${
                    type === ft.type
                      ? "bg-white border-jira-blue shadow-2xs"
                      : "border-transparent hover:bg-white/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="fieldType"
                    value={ft.type}
                    checked={type === ft.type}
                    onChange={() => setType(ft.type)}
                    className="mt-0.5 text-jira-blue focus:ring-jira-blue"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-jira-navy">
                      <CustomFieldIcon type={ft.type} />
                      {ft.label}
                    </div>
                    <p className="text-[11px] text-jira-gray-500 leading-tight">
                      {ft.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Options for SELECT or MULTI_SELECT */}
          {(type === "SELECT" || type === "MULTI_SELECT") && (
            <div className="space-y-2 p-3 bg-jira-gray-50 border border-jira-gray-300 rounded-md">
              <label className="block text-xs font-semibold text-jira-gray-700">
                Dropdown Options <span className="text-jira-red">*</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type an option and press Add..."
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption(e);
                    }
                  }}
                  className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs font-semibold px-3 py-1.5 rounded bg-jira-blue text-white hover:bg-jira-blue-hover"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {options.map((opt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-jira-gray-300 rounded-full text-xs font-medium text-jira-navy"
                  >
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="text-jira-gray-400 hover:text-jira-red"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Required Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4 rounded text-jira-blue focus:ring-jira-blue border-jira-gray-300"
              />
              <span className="text-xs font-semibold text-jira-navy">
                Required field (must be specified on issues)
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-jira-gray-200">
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
              Create Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
