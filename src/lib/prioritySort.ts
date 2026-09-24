/**
 * Sorting by priority. Priority is stored as text, so the database would put
 * High before Highest and Low before Medium. Instead the issues are counted
 * per priority, and a page is read from each priority's group in rank order.
 */

/** Highest first. */
export const PRIORITY_RANK = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as const;

/** The priorities in the order a sort shows them; values outside the scale go last. */
export function priorityOrder(values: string[], direction: "asc" | "desc"): string[] {
  const known = PRIORITY_RANK.filter((p) => values.includes(p));
  const ranked = direction === "desc" ? [...known] : [...known].reverse();
  const unknown = values.filter((v) => !(PRIORITY_RANK as readonly string[]).includes(v)).sort();
  return [...ranked, ...unknown];
}

export interface PrioritySlice {
  priority: string;
  skip: number;
  take: number;
}

/**
 * Which part of each priority's group a page covers. `counts` is the number of
 * matching issues per priority; the slices come back in display order.
 */
export function priorityPage(
  counts: Record<string, number>,
  direction: "asc" | "desc",
  skip: number,
  take: number
): PrioritySlice[] {
  const slices: PrioritySlice[] = [];
  let offset = skip;
  let remaining = take;
  for (const priority of priorityOrder(Object.keys(counts), direction)) {
    if (remaining <= 0) break;
    const count = counts[priority] ?? 0;
    if (offset >= count) {
      offset -= count;
      continue;
    }
    const n = Math.min(remaining, count - offset);
    slices.push({ priority, skip: offset, take: n });
    remaining -= n;
    offset = 0;
  }
  return slices;
}
