"use client";

import { calendarDateToLocal } from "@/lib/calendarDate";
import React from "react";
import { CustomField, CustomFieldType } from "@/types";
import { ExternalLink, Check, Calendar, Hash, Type, List, CheckSquare, Link as LinkIcon } from "lucide-react";
import { Select } from "@/components/ui/Select";

interface CustomFieldRendererProps {
  field: CustomField;
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function parseFieldOptions(optionsStr: string | null | undefined): string[] {
  if (!optionsStr) return [];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return optionsStr.split(",").map((s) => s.trim()).filter(Boolean);
}

export function CustomFieldIcon({ type, className = "w-3.5 h-3.5" }: { type: CustomFieldType; className?: string }) {
  switch (type) {
    case "NUMBER":
      return <Hash className={`${className} text-warning`} />;
    case "SELECT":
    case "MULTI_SELECT":
      return <List className={`${className} text-accent`} />;
    case "CHECKBOX":
      return <CheckSquare className={`${className} text-success`} />;
    case "DATE":
      return <Calendar className={`${className} text-accent`} />;
    case "URL":
      return <LinkIcon className={`${className} text-accent`} />;
    case "TEXT":
    default:
      return <Type className={`${className} text-muted`} />;
  }
}

export default function CustomFieldRenderer({
  field,
  value,
  onChange,
  readOnly = false,
  compact = false,
}: CustomFieldRendererProps) {
  const options = parseFieldOptions(field.options);

  // Read-only presentation mode
  if (readOnly) {
    if (!value || value.trim() === "") {
      return <span className="text-muted italic text-xs">None</span>;
    }

    switch (field.type) {
      case "CHECKBOX":
        const isChecked = value === "true" || value === "1";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
              isChecked
                ? "bg-success-soft text-success"
                : "bg-surface-sunk text-ink-2"
            }`}
          >
            {isChecked ? <Check className="w-3 h-3 text-success" /> : null}
            {isChecked ? "Yes" : "No"}
          </span>
        );

      case "SELECT":
        return (
          <span className="inline-block px-2 py-0.5 rounded bg-accent-soft/60 text-accent font-semibold text-xs border border-accent/20">
            {value}
          </span>
        );

      case "MULTI_SELECT":
        let selected: string[] = [];
        try {
          selected = JSON.parse(value);
        } catch {
          selected = value.split(",").map((s) => s.trim()).filter(Boolean);
        }
        return (
          <div className="flex flex-wrap gap-1">
            {selected.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-surface-sunk text-ink-2 border border-subtle font-medium text-[11px]"
              >
                {item}
              </span>
            ))}
          </div>
        );

      case "URL":
        return (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1 text-xs truncate max-w-xs"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        );

      case "DATE":
        return (
          <span className="text-xs text-ink font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-muted" />
            {calendarDateToLocal(value)?.toLocaleDateString()}
          </span>
        );

      case "NUMBER":
        return <span className="font-mono text-xs font-semibold text-ink">{value}</span>;

      case "TEXT":
      default:
        return <span className="text-xs text-ink">{value}</span>;
    }
  }

  // Interactive Editable Mode
  switch (field.type) {
    case "CHECKBOX":
      const checked = value === "true" || value === "1";
      return (
        <label className="flex items-center gap-2 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked ? "true" : "false")}
            className="w-4 h-4 rounded text-accent focus:ring-accent border-subtle"
          />
          <span className="text-xs text-ink font-medium">
            {checked ? "Enabled / Yes" : "Disabled / No"}
          </span>
        </label>
      );

    case "SELECT":
      return (
        <Select
          aria-label={field.name}
          value={value}
          onChange={(v) => onChange?.(v)}
          placeholder="None"
          options={[{ value: "", label: "None" }, ...options.map((opt) => ({ value: opt, label: opt }))]}
        />
      );

    case "MULTI_SELECT":
      let currentSelected: string[] = [];
      try {
        currentSelected = JSON.parse(value || "[]");
      } catch {
        currentSelected = (value || "").split(",").map((s) => s.trim()).filter(Boolean);
      }

      const toggleOption = (opt: string) => {
        let next: string[];
        if (currentSelected.includes(opt)) {
          next = currentSelected.filter((s) => s !== opt);
        } else {
          next = [...currentSelected, opt];
        }
        onChange?.(JSON.stringify(next));
      };

      return (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 p-2 bg-page border border-subtle rounded-md">
            {options.map((opt, idx) => {
              const isSelected = currentSelected.includes(opt);
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => toggleOption(opt)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-accent text-accent-fg border-accent font-semibold shadow-2xs"
                      : "bg-surface text-ink-2 border-subtle hover:bg-surface-sunk"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "DATE":
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-surface border border-subtle rounded px-2.5 py-1.5 text-xs text-ink focus:border-accent"
        />
      );

    case "NUMBER":
      return (
        <input
          type="number"
          step="any"
          placeholder="0"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-surface border border-subtle rounded px-2.5 py-1.5 text-xs text-ink focus:border-accent font-mono"
        />
      );

    case "URL":
      return (
        <input
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-surface border border-subtle rounded px-2.5 py-1.5 text-xs text-ink focus:border-accent"
        />
      );

    case "TEXT":
    default:
      return (
        <input
          type="text"
          placeholder={`Enter ${field.name.toLowerCase()}...`}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-surface border border-subtle rounded px-2.5 py-1.5 text-xs text-ink focus:border-accent"
        />
      );
  }
}
