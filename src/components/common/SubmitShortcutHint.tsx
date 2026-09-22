"use client";

import React from "react";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";

// <kbd> defaults to a monospace font, which draws ⌘ tiny and off-centre.
const KEYCAP =
  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 font-sans font-semibold leading-none " +
  "text-jira-gray-700 bg-white border border-jira-gray-300 border-b-2 rounded";

/** "Press ⌘ Enter to submit" (Ctrl on Windows/Linux) for a modal footer. */
export default function SubmitShortcutHint({ className = "" }: { className?: string }) {
  const modKey = useModKeyLabel();

  return (
    <span className={`items-center gap-1 text-xs text-jira-gray-500 ${className}`}>
      Press
      <kbd className={`${KEYCAP} ${modKey === "⌘" ? "text-[13px]" : "text-[11px]"}`}>{modKey}</kbd>
      <kbd className={`${KEYCAP} text-[11px]`}>Enter</kbd>
      to submit
    </span>
  );
}
