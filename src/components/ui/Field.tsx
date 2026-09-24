"use client";

import React, { createContext, useContext, useId } from "react";
import { cn } from "./cn";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * The props a control inside a <Field> needs: its id for the label, the ids of
 * the hint and error, and whether it is invalid. The id always comes from the
 * Field so the label can't lose its control; set a fixed one with <Field id>.
 */
export function useFieldControl<P extends { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"]; required?: boolean }>(
  props: P
): P & { required?: boolean } {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy = [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return {
    ...props,
    id: field.id,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}

export interface FieldProps {
  label: React.ReactNode;
  /** The control's id, when something else must refer to it. */
  id?: string;
  /** Help shown under the control. */
  hint?: React.ReactNode;
  /** Shown in place of the hint and announced; marks the control invalid. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A label, a control and its help or error text, wired together for screen readers. */
export function Field({ label, id: fixedId, hint, error, required = false, className, children }: FieldProps) {
  const generatedId = useId();
  const id = fixedId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-xs font-medium text-ink-2">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

const FIELD_BASE =
  "w-full rounded-control border bg-surface px-2.5 text-[13px] text-ink placeholder:text-muted " +
  "transition-colors duration-150 hover:border-strong focus:border-accent " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:opacity-60 " +
  "aria-[invalid=true]:border-danger";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  const fieldProps = useFieldControl(props);
  return <input className={cn(FIELD_BASE, "h-8 border-subtle", className)} {...fieldProps} />;
}

export type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  const fieldProps = useFieldControl(props);
  return <textarea rows={rows} className={cn(FIELD_BASE, "min-h-16 border-subtle py-1.5 leading-5", className)} {...fieldProps} />;
}
