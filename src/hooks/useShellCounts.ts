"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getMyOpenIssueCount } from "@/lib/actions/home";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";

/** Fired on window when something changes a count the rail shows. */
export const SHELL_COUNTS_EVENT = "tamam:counts-changed";

export function notifyShellCountsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SHELL_COUNTS_EVENT));
}

/**
 * The numbers beside Home and Inbox in the rail. Refreshed on navigation,
 * when the window regains focus, and whenever notifyShellCountsChanged runs.
 */
export function useShellCounts(enabled: boolean) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ openIssues: 0, unread: 0 });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [openIssues, unread] = await Promise.all([getMyOpenIssueCount(), getUnreadNotificationCount()]);
    setCounts({ openIssues, unread });
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("focus", refresh);
    window.addEventListener(SHELL_COUNTS_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(SHELL_COUNTS_EVENT, refresh);
    };
  }, [enabled, refresh]);

  return counts;
}
