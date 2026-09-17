export interface ColumnOrderPlan {
  /** The order to store on the issue being moved. */
  resolvedOrder: number;
  /** Positions to store on the other issues in the column. */
  siblingWrites: { id: string; order: number }[];
}

/**
 * Work out the order values a drop should persist.
 *
 * A board move used to store a position for the dragged issue alone, leaving
 * its neighbours on whatever they had before. Two issues could then hold the
 * same order, and the tie-break decided the board instead of the person who
 * dragged the card, so the card appeared to jump back. Writing the whole
 * column contiguously is what makes a drop stick.
 *
 * @param issueId        the issue being moved
 * @param orderedIds     the destination column in its new order, as displayed
 * @param allowedIds     sibling ids confirmed to belong to the same project
 * @param fallbackOrder  used when no column listing was supplied
 */
export function planColumnOrder(
  issueId: string,
  orderedIds: string[] | undefined,
  allowedIds: Iterable<string>,
  fallbackOrder: number
): ColumnOrderPlan {
  const allowed = new Set(allowedIds);

  // Ignore anything that is neither the moved issue nor a verified sibling, and
  // collapse duplicates so a repeated id cannot claim two positions.
  const seen = new Set<string>();
  const cleaned = (orderedIds ?? []).filter((id) => {
    if (id !== issueId && !allowed.has(id)) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const position = cleaned.indexOf(issueId);

  return {
    resolvedOrder: position >= 0 ? position : fallbackOrder,
    siblingWrites: cleaned
      .map((id, order) => ({ id, order }))
      .filter((entry) => entry.id !== issueId),
  };
}
