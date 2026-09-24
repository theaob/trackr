"use client";

import React from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { cn } from "@/components/ui/cn";

/**
 * The status colours: the chart palette's hues plus two greys, so a status,
 * its board column and its band in the reports share one set of colours.
 */
export const STATUS_SWATCHES = [
  { name: "Grey", hex: "#64748b" },
  { name: "Light grey", hex: "#94a3b8" },
  { name: "Blue", hex: "#2a78d6" },
  { name: "Violet", hex: "#4a3aa7" },
  { name: "Aqua", hex: "#1baf7a" },
  { name: "Green", hex: "#008300" },
  { name: "Yellow", hex: "#eda100" },
  { name: "Orange", hex: "#eb6834" },
  { name: "Pink", hex: "#e87ba4" },
  { name: "Red", hex: "#e34948" },
];

/** A colour button that opens the swatches, with a custom colour as the last choice. */
export default function ColorSwatchPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const current = STATUS_SWATCHES.find((s) => s.hex.toLowerCase() === value.toLowerCase());
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label}: ${current?.name ?? value}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-control border border-subtle hover:border-strong disabled:opacity-60"
        >
          <span aria-hidden="true" className="h-4 w-4 rounded-[3px]" style={{ backgroundColor: value }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div role="group" aria-label={label} className="grid grid-cols-5 gap-1.5">
          {STATUS_SWATCHES.map((s) => {
            const selected = s.hex.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={s.hex}
                type="button"
                aria-label={s.name}
                aria-pressed={selected}
                onClick={() => onChange(s.hex)}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-control ring-offset-2 ring-offset-surface",
                  selected && "ring-2 ring-ink"
                )}
                style={{ backgroundColor: s.hex }}
              >
                {selected && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex items-center justify-between gap-2 border-t border-subtle pt-2 text-xs text-ink-2">
          Custom colour
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded-control border border-subtle bg-surface"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
