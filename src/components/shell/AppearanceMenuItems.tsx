"use client";

import React from "react";
import { useAppearance } from "@/hooks/useAppearance";
import { readDensity, readTheme } from "@/lib/appearance";
import { MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "@/components/ui/Menu";

/** Theme and density, for the account menu. Choosing one keeps the menu open. */
export default function AppearanceMenuItems() {
  const { theme, density, setTheme, setDensity } = useAppearance();
  const keepOpen = (e: Event) => e.preventDefault();
  return (
    <>
      <MenuLabel>Theme</MenuLabel>
      <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(readTheme(v))}>
        <MenuRadioItem value="light" onSelect={keepOpen}>
          Light
        </MenuRadioItem>
        <MenuRadioItem value="dark" onSelect={keepOpen}>
          Dark
        </MenuRadioItem>
        <MenuRadioItem value="system" onSelect={keepOpen}>
          Match system
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuLabel>Density</MenuLabel>
      <MenuRadioGroup value={density} onValueChange={(v) => setDensity(readDensity(v))}>
        <MenuRadioItem value="comfortable" onSelect={keepOpen}>
          Comfortable
        </MenuRadioItem>
        <MenuRadioItem value="compact" onSelect={keepOpen}>
          Compact
        </MenuRadioItem>
      </MenuRadioGroup>
    </>
  );
}
