"use client";

import React from "react";
import { CustomField, CustomFieldType } from "@/types";
import { ExternalLink, Check, Calendar, Hash, Type, List, CheckSquare, Link as LinkIcon } from "lucide-react";

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
      return <Hash className={`${className} text-amber-500`} />;
    case "SELECT":
    case "MULTI_SELECT":
      return <List className={`${className} text-jira-blue`} />;
    case "CHECKBOX":
      return <CheckSquare className={`${className} text-emerald-500`} />;
    case "DATE":
      return <Calendar className={`${className} text-purple-500`} />;
    case "URL":
      return <LinkIcon className={`${className} text-sky-500`} />;
    case "TEXT":
    default:
      return <Type className={`${className} text-jira-gray-500`} />;
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
      return <span className="text-jira-gray-400 italic text-xs">None</span>;
    }

    switch (field.type) {
      case "CHECKBOX":
        const isChecked = value === "true" || value === "1";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
              isChecked
                ? "bg-emerald-100 text-emerald-800"
                : "bg-jira-gray-100 text-jira-gray-600"
            }`}
          >
            {isChecked ? <Check className="w-3 h-3 text-emerald-600" /> : null}
            {isChecked ? "Yes" : "No"}
          </span>
        );

      case "SELECT":
        return (
          <span className="inline-block px-2 py-0.5 rounded bg-jira-blue-light/60 text-jira-blue font-semibold text-xs border border-jira-blue/20">
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
                className="px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-700 border border-jira-gray-300 font-medium text-[11px]"
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
            className="text-jira-blue hover:underline inline-flex items-center gap-1 text-xs truncate max-w-xs"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        );

      case "DATE":
        return (
          <span className="text-xs text-jira-navy font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-jira-gray-500" />
            {new Date(value).toLocaleDateString()}
          </span>
        );

      case "NUMBER":
        return <span className="font-mono text-xs font-semibold text-jira-navy">{value}</span>;

      case "TEXT":
      default:
        return <span className="text-xs text-jira-navy">{value}</span>;
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
            className="w-4 h-4 rounded text-jira-blue focus:ring-jira-blue border-jira-gray-300"
          />
          <span className="text-xs text-jira-navy font-medium">
            {checked ? "Enabled / Yes" : "Disabled / No"}
          </span>
        </label>
      );

    case "SELECT":
      return (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none"
        >
          <option value="">None (Select an option)</option>
          {options.map((opt, idx) => (
            <option key={idx} value={opt}>
              {opt}
            </option>
          ))}
        </select>
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
          <div className="flex flex-wrap gap-1.5 p-2 bg-jira-gray-50 border border-jira-gray-300 rounded-md">
            {options.map((opt, idx) => {
              const isSelected = currentSelected.includes(opt);
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => toggleOption(opt)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-jira-blue text-white border-jira-blue font-semibold shadow-2xs"
                      : "bg-white text-jira-gray-700 border-jira-gray-300 hover:bg-jira-gray-100"
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
          className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none"
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
          className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none font-mono"
        />
      );

    case "URL":
      return (
        <input
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none"
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
          className="w-full bg-white border border-jira-gray-300 rounded px-2.5 py-1.5 text-xs text-jira-navy focus:border-jira-blue outline-none"
        />
      );
  }
}
