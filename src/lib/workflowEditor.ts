/**
 * What the workflow settings show about each status: where issues in it can
 * go, where they can come from, and whether that leaves anything stuck.
 */

export interface EditorStatus {
  id: string;
  name: string;
  category: string;
  isBacklog: boolean;
  order: number;
}

export interface EditorTransition {
  fromId: string;
  toId: string;
}

export interface StatusFlow {
  /** Statuses an issue here can move to, in workflow order. */
  to: string[];
  /** Statuses an issue can arrive here from, in workflow order. */
  from: string[];
  /** Every other status is a destination. */
  toAll: boolean;
  /** Every other status leads here. */
  fromAll: boolean;
}

export const transitionKey = (fromId: string, toId: string) => `${fromId}:${toId}`;

export function statusFlows(statuses: EditorStatus[], transitions: EditorTransition[]): Map<string, StatusFlow> {
  const keys = new Set(transitions.map((t) => transitionKey(t.fromId, t.toId)));
  const flows = new Map<string, StatusFlow>();
  for (const s of statuses) {
    const others = statuses.filter((o) => o.id !== s.id);
    const to = others.filter((o) => keys.has(transitionKey(s.id, o.id))).map((o) => o.id);
    const from = others.filter((o) => keys.has(transitionKey(o.id, s.id))).map((o) => o.id);
    flows.set(s.id, {
      to,
      from,
      toAll: others.length > 0 && to.length === others.length,
      fromAll: others.length > 0 && from.length === others.length,
    });
  }
  return flows;
}

/**
 * Problems worth pointing out: a status nothing leads to can only be reached
 * by creating issues in it, and one with no way out (other than a done
 * status, where that's the point) traps whatever lands there.
 */
export function statusWarnings(status: EditorStatus, flow: StatusFlow | undefined, statusCount: number): string[] {
  if (!flow || statusCount < 2) return [];
  const warnings: string[] = [];
  if (flow.from.length === 0) warnings.push("No status leads here");
  if (flow.to.length === 0 && status.category !== "DONE") warnings.push("Issues here can't move on");
  return warnings;
}

/** The board's columns, left to right, and the statuses kept to the backlog. */
export function boardLayout<T extends EditorStatus>(statuses: T[]): { columns: T[]; backlog: T[] } {
  const ordered = [...statuses].sort((a, b) => a.order - b.order);
  return { columns: ordered.filter((s) => !s.isBacklog), backlog: ordered.filter((s) => s.isBacklog) };
}

/** Every move between two different statuses. */
export function everyTransition(statuses: { id: string }[]): EditorTransition[] {
  return statuses.flatMap((from) =>
    statuses.filter((to) => to.id !== from.id).map((to) => ({ fromId: from.id, toId: to.id }))
  );
}

/**
 * The transitions after giving `statusId` exactly these destinations and
 * sources; moves between other statuses are left as they were.
 */
export function withStatusTransitions(
  transitions: EditorTransition[],
  statusId: string,
  to: string[],
  from: string[]
): EditorTransition[] {
  const kept = transitions.filter((t) => t.fromId !== statusId && t.toId !== statusId);
  return [
    ...kept,
    ...to.filter((id) => id !== statusId).map((toId) => ({ fromId: statusId, toId })),
    ...from.filter((id) => id !== statusId).map((fromId) => ({ fromId, toId: statusId })),
  ];
}

/** Moves the item at `from` to `to`, as a drag in a list does. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
