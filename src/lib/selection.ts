/**
 * Multi-select in a list, the way file managers do it: a checkbox or ⌘/Ctrl
 * toggles one row, Shift selects the range from the last row picked.
 */

export interface SelectionState {
  ids: Set<string>;
  /** The row a Shift-click extends from. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { ids: new Set(), anchor: null };

export function toggleSelection(state: SelectionState, id: string): SelectionState {
  const ids = new Set(state.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
}

/**
 * Adds every row between the anchor and `id` in `order` (the list they're
 * shown in). With no anchor in that list, it selects just `id`.
 */
export function extendSelection(state: SelectionState, id: string, order: string[]): SelectionState {
  const from = state.anchor ? order.indexOf(state.anchor) : -1;
  const to = order.indexOf(id);
  if (from < 0 || to < 0) return toggleSelection(state, id);
  const [start, end] = from < to ? [from, to] : [to, from];
  const ids = new Set(state.ids);
  for (const rowId of order.slice(start, end + 1)) ids.add(rowId);
  return { ids, anchor: state.anchor };
}

/** Drops ids that are no longer shown (deleted, filtered out), keeping the rest. */
export function pruneSelection(state: SelectionState, visible: Iterable<string>): SelectionState {
  const keep = new Set(visible);
  const ids = new Set([...state.ids].filter((id) => keep.has(id)));
  if (ids.size === state.ids.size) return state;
  return { ids, anchor: state.anchor && keep.has(state.anchor) ? state.anchor : null };
}
