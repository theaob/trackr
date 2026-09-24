/**
 * Keyboard movement through a list of options, shared by Select and Combobox.
 * Pure, so the rules (wrap around, skip disabled options) are tested directly.
 * Matching lowercases without a locale: under Turkish rules "I" becomes "ı",
 * and typing "i" would no longer find "Issue".
 */

export interface NavigableOption {
  disabled?: boolean;
}

/** The first enabled option at or after `from` moving by `step`, wrapping; -1 if none. */
function seek(options: NavigableOption[], from: number, step: 1 | -1): number {
  const count = options.length;
  for (let i = 0; i < count; i++) {
    const index = (((from + step * i) % count) + count) % count;
    if (!options[index].disabled) return index;
  }
  return -1;
}

/**
 * Where the active option goes for a key, or null when the key isn't a
 * movement key. With nothing active, Down starts at the top and Up at the bottom.
 */
export function nextActiveIndex(options: NavigableOption[], current: number, key: string): number | null {
  if (options.length === 0) return key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End" ? -1 : null;
  switch (key) {
    case "ArrowDown":
      return seek(options, current < 0 ? 0 : current + 1, 1);
    case "ArrowUp":
      return seek(options, current < 0 ? options.length - 1 : current - 1, -1);
    case "Home":
      return seek(options, 0, 1);
    case "End":
      return seek(options, options.length - 1, -1);
    default:
      return null;
  }
}

/** The first enabled option whose label starts with the typed text, searching after the current one first. */
export function typeaheadIndex(labels: { label: string; disabled?: boolean }[], current: number, typed: string): number {
  const query = typed.toLowerCase();
  if (!query) return current;
  const count = labels.length;
  // A repeated single letter cycles through the options with that letter.
  const start = query.length === 1 ? current + 1 : Math.max(current, 0);
  for (let i = 0; i < count; i++) {
    const index = (start + i) % count;
    const option = labels[index];
    if (!option.disabled && option.label.toLowerCase().startsWith(query)) return index;
  }
  return current;
}

/** Options whose label or description contains every typed word, in their original order. */
export function filterOptions<T extends { label: string; description?: string; keywords?: string }>(options: T[], query: string): T[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const text = `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
