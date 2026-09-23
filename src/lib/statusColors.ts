/**
 * Status colors shared by the workflow settings, lozenges and every report.
 * Safe to import from client components.
 */

export type StatusCategoryKey = "TODO" | "IN_PROGRESS" | "DONE";

/** Each category's color in the default workflow. A new status starts with its category's color. */
export const CATEGORY_COLORS: Record<StatusCategoryKey, string> = {
  TODO: "#64748B",
  IN_PROGRESS: "#2563EB",
  DONE: "#059669",
};

/**
 * The gray statuses were created with before they took their category's
 * color. Nobody picked it: a color picker always reports lowercase hex, so
 * this exact uppercase value only ever comes from the old default.
 */
export const UNSET_STATUS_COLOR = "#6B7280";

/** For an issue whose status has since been removed from the workflow. */
export const UNKNOWN_STATUS_COLOR = "#A5ADBA";

export function defaultStatusColor(category: string | null | undefined): string {
  return CATEGORY_COLORS[category as StatusCategoryKey] ?? CATEGORY_COLORS.TODO;
}

/** Whether a status still has a default color rather than one someone chose. */
export function isDefaultStatusColor(color: string | null | undefined, category: string | null | undefined): boolean {
  return !color || color === UNSET_STATUS_COLOR || color.toLowerCase() === defaultStatusColor(category).toLowerCase();
}

const CATEGORY_RANK: Record<string, number> = { DONE: 0, IN_PROGRESS: 1, TODO: 2 };

/**
 * Statuses in stacking order: finished work first, then later workflow stages
 * before earlier ones. That's bottom-to-top in a cumulative flow diagram and
 * left-to-right in a progress bar.
 */
export function stackingOrder<T extends { category: string; order: number }>(statuses: T[]): T[] {
  return statuses
    .slice()
    .sort(
      (a, b) =>
        (CATEGORY_RANK[a.category] ?? 3) - (CATEGORY_RANK[b.category] ?? 3) || b.order - a.order
    );
}
