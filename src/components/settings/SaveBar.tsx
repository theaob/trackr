"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

/**
 * The bar along the bottom of a settings section that has unsaved changes.
 * It only appears once something has changed, and goes when saved or
 * discarded. `form` ties the Save button to the section's form.
 */
export default function SaveBar({
  dirty,
  saving,
  form,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  form: string;
  onDiscard: () => void;
}) {
  if (!dirty) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-10 -mx-1 mt-6 flex items-center justify-between gap-3 rounded-card border border-subtle bg-surface px-4 py-2.5 shadow-overlay"
    >
      <p className="text-[13px] text-ink">You have unsaved changes.</p>
      <span className="flex items-center gap-2">
        <Button onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button type="submit" form={form} variant="primary" loading={saving}>
          Save changes
        </Button>
      </span>
    </div>
  );
}
