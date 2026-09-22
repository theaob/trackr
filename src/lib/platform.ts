/**
 * Whether a user agent string identifies a Mac (or iOS, which reports as
 * "Mac" too under desktop-mode Safari). Keyboard-shortcut hints use this to
 * show the right modifier key label instead of always showing ⌘.
 */
export function isMacUserAgent(userAgent: string): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(userAgent);
}

/** The modifier-key label to show for a "Cmd/Ctrl" shortcut hint. */
export function modKeyLabel(userAgent: string): string {
  return isMacUserAgent(userAgent) ? "⌘" : "Ctrl";
}
