"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `refetch` whenever this tab becomes visible again or the window
 * regains focus.
 *
 * Server actions in another tab (or another user's session) never reach this
 * one -- there's no push channel, so data changed elsewhere sits stale here
 * until something asks the server again. Coming back to the tab is the moment
 * someone would notice, so that's when to ask. Returning usually fires both
 * events at once; calls within `minIntervalMs` of each other collapse into one.
 */
export function useRefetchOnFocus(refetch: () => unknown, minIntervalMs = 1000) {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });

  useEffect(() => {
    let lastRun = 0;
    const run = () => {
      const now = Date.now();
      if (now - lastRun < minIntervalMs) return;
      lastRun = now;
      Promise.resolve()
        .then(() => latest.current())
        .catch((err) => console.error("Failed to refresh after returning to the tab", err));
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", run);
    };
  }, [minIntervalMs]);
}
