"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/** "Show 50 older comments (120 more)" under a paged list. */
export default function ShowOlderButton({
  remaining,
  pageSize = 50,
  noun,
  loading,
  onClick,
}: {
  remaining: number;
  pageSize?: number;
  noun: string;
  loading: boolean;
  onClick: () => void;
}) {
  if (remaining <= 0) return null;
  const next = Math.min(pageSize, remaining);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full py-1.5 text-xs font-semibold text-jira-blue hover:bg-jira-blue-subtle rounded flex items-center justify-center gap-1.5 disabled:opacity-60"
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      Show {next} older {noun}
      {remaining > next ? ` (${remaining} more)` : ""}
    </button>
  );
}
