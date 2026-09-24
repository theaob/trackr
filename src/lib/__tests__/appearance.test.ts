// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { APPEARANCE_EVENT, APPEARANCE_SCRIPT, DENSITY_KEY, THEME_KEY, readDensity, readTheme, resolveTheme } from "@/lib/appearance";
import { activeTab } from "@/components/shell/TabBar";

function runScript(systemDark: boolean) {
  const listeners: (() => void)[] = [];
  vi.stubGlobal("matchMedia", () => ({ matches: systemDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) }));
  new Function(APPEARANCE_SCRIPT)();
  return listeners;
}

describe("appearance", () => {
  it("reads stored choices, defaulting to the system theme and comfortable rows", () => {
    expect(readTheme("dark")).toBe("dark");
    expect(readTheme("purple")).toBe("system");
    expect(readTheme(null)).toBe("system");
    expect(readDensity("compact")).toBe("compact");
    expect(readDensity(undefined)).toBe("comfortable");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("the head script applies the choice before paint, and every change after", () => {
    localStorage.clear();
    const systemListeners = runScript(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.density).toBe("comfortable");

    localStorage.setItem(THEME_KEY, "light");
    localStorage.setItem(DENSITY_KEY, "compact");
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(systemListeners).toHaveLength(1);
  });
});

describe("tab bar", () => {
  it("knows which tab a page belongs to", () => {
    expect(activeTab("/home")).toBe("home");
    expect(activeTab("/inbox")).toBe("inbox");
    expect(activeTab("/projects/APOLLO/board")).toBe("board");
    expect(activeTab("/projects/APOLLO/issues")).toBe("issues");
    expect(activeTab("/projects/APOLLO/issues/APOLLO-3")).toBe("issues");
    expect(activeTab("/projects/APOLLO/reports")).toBeNull();
  });
});
