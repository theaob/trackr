/**
 * Theme and density, chosen in the account menu and remembered per browser.
 * `data-theme` and `data-density` on <html> switch the CSS variables in
 * globals.css, so no component needs a dark: or compact: class.
 */
export type ThemeChoice = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

export const THEME_KEY = "trackr:theme";
export const DENSITY_KEY = "trackr:density";
/** Fired on window when either changes, so every control showing it updates. */
export const APPEARANCE_EVENT = "trackr:appearance";

export function readTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function readDensity(value: string | null | undefined): Density {
  return value === "compact" ? "compact" : "comfortable";
}

/** The theme to draw: "system" follows the operating system. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

/**
 * Runs in <head> before the page paints, so a dark page never flashes white.
 * It applies every later change too (the account menu fires APPEARANCE_EVENT),
 * and follows the system theme while the choice is "Match system". Colour
 * transitions are switched off for the moment of the change, so the page
 * swaps at once instead of fading control by control.
 * Kept dependency-free and tiny; it mirrors readTheme/resolveTheme above.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var n=document.createElement("style");n.textContent="*,*::before,*::after{transition:none!important}";document.head.appendChild(n);var c=s.getItem(${JSON.stringify(
  THEME_KEY
)});d.dataset.theme=c==="light"||c==="dark"?c:m.matches?"dark":"light";d.dataset.density=s.getItem(${JSON.stringify(
  DENSITY_KEY
)})==="compact"?"compact":"comfortable";window.getComputedStyle(d).color;setTimeout(function(){n.remove()},0)}a();m.addEventListener("change",a);window.addEventListener(${JSON.stringify(
  APPEARANCE_EVENT
)},a)}catch(e){}})();`;
