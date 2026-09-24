import { beforeEach, describe, expect, it, vi } from "vitest";
import { priorityOrder, priorityPage } from "@/lib/prioritySort";
import { BUILT_IN_VIEWS, COLUMNS, viewQuery } from "@/lib/issueQuery";

type Row = { id: string; priority: string; createdAt: number };
const { rows } = vi.hoisted(() => ({ rows: { list: [] as Row[] } }));

// Just enough of Prisma for the paginated issue query: filter by priority,
// order by createdAt, skip and take, count per priority.
const matches = (where: any, r: Row): boolean => {
  if (!where) return true;
  if (where.AND) return where.AND.every((w: any) => matches(w, r));
  if (typeof where.priority === "string") return r.priority === where.priority;
  if (where.priority?.in) return where.priority.in.includes(r.priority);
  return true;
};
vi.mock("@/lib/db", () => {
  const issue = {
    groupBy: vi.fn(async ({ where }: any) => {
      const counts = new Map<string, number>();
      for (const r of rows.list.filter((r) => matches(where, r))) counts.set(r.priority, (counts.get(r.priority) ?? 0) + 1);
      return [...counts].map(([priority, n]) => ({ priority, _count: { _all: n } }));
    }),
    findMany: vi.fn(async ({ where, orderBy, skip = 0, take }: any) => {
      const order = (Array.isArray(orderBy) ? orderBy : [orderBy]).find((o: any) => o?.createdAt);
      const dir = order?.createdAt === "asc" ? 1 : -1;
      const found = rows.list.filter((r) => matches(where, r)).sort((a, b) => dir * (a.createdAt - b.createdAt));
      return found.slice(skip, take === undefined ? undefined : skip + take);
    }),
    count: vi.fn(async ({ where }: any) => rows.list.filter((r) => matches(where, r)).length),
  };
  return {
    default: {
      issue,
      sprint: { findMany: vi.fn(async () => []) },
      version: { findMany: vi.fn(async () => []) },
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/auth/guards", () => ({
  requireProjectAccess: vi.fn(async () => undefined),
  accessibleProjectIds: vi.fn(async () => ["p1"]),
  teamProjectIds: vi.fn(async () => new Set(["p1"])),
}));

import { getPaginatedIssues } from "@/lib/actions/issues";

describe("priority order", () => {
  it("ranks Highest to Lowest, not alphabetically, with unknown values last", () => {
    expect(priorityOrder(["LOW", "HIGH", "MEDIUM", "HIGHEST", "LOWEST"], "desc")).toEqual(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]);
    expect(priorityOrder(["LOW", "HIGH", "URGENT"], "asc")).toEqual(["LOW", "HIGH", "URGENT"]);
  });

  it("reads a page across priority groups", () => {
    const counts = { HIGHEST: 2, HIGH: 3, LOW: 4 };
    expect(priorityPage(counts, "desc", 0, 4)).toEqual([
      { priority: "HIGHEST", skip: 0, take: 2 },
      { priority: "HIGH", skip: 0, take: 2 },
    ]);
    expect(priorityPage(counts, "desc", 4, 4)).toEqual([
      { priority: "HIGH", skip: 2, take: 1 },
      { priority: "LOW", skip: 0, take: 3 },
    ]);
    expect(priorityPage(counts, "asc", 0, 5)).toEqual([
      { priority: "LOW", skip: 0, take: 4 },
      { priority: "HIGH", skip: 0, take: 1 },
    ]);
    expect(priorityPage(counts, "desc", 20, 5)).toEqual([]);
  });

  it("is a sortable column, and the High priority view uses it", () => {
    expect(COLUMNS.find((c) => c.id === "priority")?.sort).toBe("priority");
    expect(viewQuery(BUILT_IN_VIEWS.find((v) => v.id === "preset-high")!, null).sort).toEqual({ field: "priority", direction: "DESC" });
  });
});

describe("sorting the issue list by priority", () => {
  beforeEach(() => {
    const priorities = ["LOW", "HIGHEST", "MEDIUM", "HIGH", "LOWEST", "HIGH", "MEDIUM", "HIGHEST", "LOW", "MEDIUM", "HIGH", "LOWEST"];
    rows.list = priorities.map((priority, i) => ({ id: `i${i}`, priority, createdAt: i }));
  });

  it("pages through issues highest first, newest first within a priority", async () => {
    const seen: string[] = [];
    for (const page of [1, 2]) {
      const res = await getPaginatedIssues({ projectId: "p1", tql: "ORDER BY priority DESC", page, pageSize: 10 });
      expect(res.totalCount).toBe(12);
      seen.push(...res.issues.map((i: any) => `${i.priority}:${i.id}`));
    }
    expect(seen).toEqual([
      "HIGHEST:i7",
      "HIGHEST:i1",
      "HIGH:i10",
      "HIGH:i5",
      "HIGH:i3",
      "MEDIUM:i9",
      "MEDIUM:i6",
      "MEDIUM:i2",
      "LOW:i8",
      "LOW:i0",
      "LOWEST:i11",
      "LOWEST:i4",
    ]);
  });

  it("puts Lowest first when ascending, and still filters", async () => {
    const res = await getPaginatedIssues({ projectId: "p1", tql: 'priority in ("HIGH", "LOW") ORDER BY priority ASC', pageSize: 10 });
    expect(res.issues.map((i: any) => i.priority)).toEqual(["LOW", "LOW", "HIGH", "HIGH", "HIGH"]);
  });
});
