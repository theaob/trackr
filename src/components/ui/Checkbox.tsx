"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { useFieldControl } from "./Field";

export interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** Shown beside the box; clicking it toggles the box. */
  label?: React.ReactNode;
  /** The "some but not all" state, as in a select-all box. */
  indeterminate?: boolean;
}

/** A native checkbox, so forms, labels and keyboard behave as browsers expect. */
export function Checkbox({ label, indeterminate = false, className, ref, ...props }: CheckboxProps) {
  const inner = useRef<HTMLInputElement | null>(null);
  const fieldProps = useFieldControl(props);

  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <input
      type="checkbox"
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border-subtle accent-[rgb(var(--color-accent))]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !label && className
      )}
      {...fieldProps}
    />
  );

  if (!label) return box;
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        className
      )}
    >
      {box}
      <span>{label}</span>
    </label>
  );
}

export interface SwitchProps extends Omit<React.ComponentProps<"button">, "onChange" | "value" | "defaultValue"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label; without one, pass aria-label. */
  label?: React.ReactNode;
}

/** An on/off setting that takes effect immediately (use a Checkbox inside forms that need saving). */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  label,
  disabled,
  className,
  onClick,
  ...props
}: SwitchProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const isOn = checked ?? uncontrolled;
  const { required, ...fieldProps } = useFieldControl(props);

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-required={required || undefined}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (checked === undefined) setUncontrolled(!isOn);
        onCheckedChange?.(!isOn);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isOn ? "bg-accent" : "bg-strong",
        !label && className
      )}
      {...fieldProps}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-raised transition-transform duration-150 motion-reduce:transition-none",
          isOn ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );

  if (!label) return control;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink", className)}>
      {control}
      <span>{label}</span>
    </label>
  );
}
