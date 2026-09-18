/** Trim whitespace only; the name is otherwise kept exactly as typed. */
export function normalizeLabelName(raw: string): string {
  return raw.trim();
}

/**
 * Jira's rule for labels: no whitespace (so a label reads as one token
 * everywhere it's rendered -- a board chip, a filter, a URL param).
 */
export function isValidLabelName(name: string): boolean {
  if (!name) return false;
  if (/\s/.test(name)) return false;
  return true;
}
