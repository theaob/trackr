/**
 * Settings read from the environment. Since the rename to Tamam they're
 * TAMAM_*, and the TRACKR_* names from before still work, so an existing
 * install upgrades without touching its configuration. TAMAM_* wins if both
 * are set.
 */
export function setting(name: string): string | undefined {
  // An empty value counts as unset, so a compose file can pass both names.
  return process.env[`TAMAM_${name}`] || process.env[`TRACKR_${name}`] || undefined;
}

/** A switch that is on when set to "1". */
export function settingOn(name: string): boolean {
  return setting(name) === "1";
}
