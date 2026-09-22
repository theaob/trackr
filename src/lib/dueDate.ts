import { isCalendarDateBeforeToday } from "@/lib/calendarDate";

/**
 * An issue reads as overdue once its due day has ended, unless it's already
 * in a done-category status -- a late issue that's finished isn't something
 * to flag. Something due today is not overdue yet.
 */
export function isOverdue(
  dueDate: string | Date | null | undefined,
  status: string,
  doneStatusNames: string[],
  now: Date = new Date()
): boolean {
  if (!dueDate) return false;
  const statusUpper = status.toUpperCase();
  if (
    doneStatusNames.some(
      (d) => d === status || d.toUpperCase() === statusUpper
    )
  ) {
    return false;
  }
  return isCalendarDateBeforeToday(dueDate, now);
}
