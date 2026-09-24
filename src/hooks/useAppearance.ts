"use client";

import { useCallback, useEffect, useState } from "react";
import { APPEARANCE_EVENT, DENSITY_KEY, THEME_KEY, readDensity, readTheme, type Density, type ThemeChoice } from "@/lib/appearance";

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The theme and density choices, and setters that apply them at once. */
export function useAppearance() {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [density, setDensityState] = useState<Density>("comfortable");

  useEffect(() => {
    const sync = () => {
      setThemeState(readTheme(read(THEME_KEY)));
      setDensityState(readDensity(read(DENSITY_KEY)));
    };
    sync();
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  // The script in <head> (APPEARANCE_SCRIPT) listens for the event and applies
  // both; it's what turns "Match system" into light or dark.
  const setTheme = useCallback((next: ThemeChoice) => {
    store(THEME_KEY, next);
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
  }, []);

  const setDensity = useCallback((next: Density) => {
    store(DENSITY_KEY, next);
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
  }, []);

  return { theme, density, setTheme, setDensity };
}
