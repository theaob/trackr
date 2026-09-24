/** Settings read from the environment, named TAMAM_*. */
export function setting(name: string): string | undefined {
  // An empty value counts as unset, as the compose file passes every name.
  return process.env[`TAMAM_${name}`] || undefined;
}

/** A switch that is on when set to "1". */
export function settingOn(name: string): boolean {
  return setting(name) === "1";
}
