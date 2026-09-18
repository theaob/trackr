/** Trim whitespace only; the name is otherwise kept exactly as typed. */
export function normalizeComponentName(raw: string): string {
  return raw.trim();
}

const MAX_COMPONENT_NAME_LENGTH = 100;

/**
 * Unlike a label, a component name is a normal display name (e.g. "Backend
 * API") -- spaces are fine, it just can't be empty or unreasonably long.
 */
export function isValidComponentName(name: string): boolean {
  if (!name) return false;
  if (name.length > MAX_COMPONENT_NAME_LENGTH) return false;
  return true;
}
