import { format } from "date-fns";

/**
 * Calendar dates -- due dates, start dates, release dates, worklog days and
 * date custom fields -- have no time of day. They are saved as midnight UTC
 * ("2026-09-22" becomes 2026-09-22T00:00Z), so they have to be read back in
 * UTC as well: formatting one in the viewer's own time zone shows the previous
 * day anywhere west of UTC.
 *
 * (Sprint start/end are different: those are chosen as local times.)
 */

type CalendarValue = string | Date | null | undefined;

/** The stored calendar date as local midnight, for formatting and date math. */
export function calendarDateToLocal(value: CalendarValue): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Format a stored calendar date with a date-fns pattern; "" when absent. */
export function formatCalendarDate(value: CalendarValue, pattern: string): string {
  const local = calendarDateToLocal(value);
  return local ? format(local, pattern) : "";
}

/** "YYYY-MM-DD" for a stored calendar date, as used by date inputs; "" when absent. */
export function calendarDateKey(value: CalendarValue): string {
  return formatCalendarDate(value, "yyyy-MM-dd");
}

/** Today's date where the viewer is, as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** True once the whole calendar day `value` has passed for the viewer. */
export function isCalendarDateBeforeToday(value: CalendarValue, now: Date = new Date()): boolean {
  const key = calendarDateKey(value);
  return key !== "" && key < todayKey(now);
}
