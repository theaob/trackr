/**
 * An issue reads as overdue once its due date has passed, unless it's
 * already in a done-category status -- a late issue that's finished isn't
 * something to flag.
 */
export function isOverdue(
  dueDate: string | Date | null | undefined,
  status: string,
  doneStatusNames: string[]
): boolean {
  if (!dueDate) return false;
  if (doneStatusNames.includes(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}
