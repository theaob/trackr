/**
 * Jira-style compact duration format ("3h 30m", "2d", "1w 2d 4h") in and out
 * of seconds. Working-time conventions match Jira's own defaults: a day is
 * 8 hours, a week is 5 days -- there's no per-project configuration for this.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 8 * SECONDS_PER_HOUR;
const SECONDS_PER_WEEK = 5 * SECONDS_PER_DAY;

const UNIT_SECONDS: Record<string, number> = {
  w: SECONDS_PER_WEEK,
  d: SECONDS_PER_DAY,
  h: SECONDS_PER_HOUR,
  m: SECONDS_PER_MINUTE,
};

const TOKEN_RE = /(\d+(?:\.\d+)?)\s*(w|d|h|m)/g;

/**
 * Parses "1w 2d 3h 4m" (any subset, any order, with or without spaces) into
 * whole seconds. Returns null for an empty string (meaning "no estimate",
 * distinct from an explicit "0h") or for input that doesn't fully resolve
 * into duration tokens, so a typo doesn't silently save as zero.
 */
export function parseDuration(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  let total = 0;
  let consumed = "";
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(trimmed)) !== null) {
    consumed += match[0];
    total += parseFloat(match[1]) * UNIT_SECONDS[match[2]];
  }

  if (!consumed) return null;
  // Reject leftover, unrecognized content (e.g. "3h junk") rather than
  // silently ignoring it -- whitespace between tokens is the only thing
  // allowed to differ between the input and what was actually consumed.
  if (trimmed.replace(/\s+/g, "") !== consumed.replace(/\s+/g, "")) return null;

  return Math.round(total);
}

/** Formats whole seconds back into the compact form, largest unit first. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";

  let remaining = Math.round(totalSeconds);
  const weeks = Math.floor(remaining / SECONDS_PER_WEEK);
  remaining -= weeks * SECONDS_PER_WEEK;
  const days = Math.floor(remaining / SECONDS_PER_DAY);
  remaining -= days * SECONDS_PER_DAY;
  const hours = Math.floor(remaining / SECONDS_PER_HOUR);
  remaining -= hours * SECONDS_PER_HOUR;
  const minutes = Math.round(remaining / SECONDS_PER_MINUTE);

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "0m";
}
