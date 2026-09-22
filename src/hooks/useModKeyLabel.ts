"use client";

import { useEffect, useState } from "react";
import { modKeyLabel } from "@/lib/platform";

/**
 * The modifier-key label ("⌘" on Mac, "Ctrl" elsewhere) for a shortcut
 * hint. Starts as "Ctrl" so server and first client render match, then
 * corrects itself after mount once navigator.userAgent is available.
 */
export function useModKeyLabel(): string {
  const [label, setLabel] = useState("Ctrl");

  useEffect(() => {
    setLabel(modKeyLabel(navigator.userAgent));
  }, []);

  return label;
}
