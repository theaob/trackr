import { describe, expect, it } from "vitest";
import { planColumnOrder } from "@/lib/boardOrder";

const column = ["a", "b", "c", "d"];
const siblings = ["a", "b", "c", "d"];

describe("planColumnOrder", () => {
  it("gives the moved issue the position it was dropped at", () => {
    // "c" dragged to the top.
    const plan = planColumnOrder("c", ["c", "a", "b", "d"], siblings, 99);
    expect(plan.resolvedOrder).toBe(0);
  });

  // The bug: only the dragged card was written, so its neighbours kept stale
  // order values, two issues ended up equal, and the tie-break put the card
  // back where it started.
  it("writes a position for every other issue in the column", () => {
    const plan = planColumnOrder("c", ["c", "a", "b", "d"], siblings, 99);
    expect(plan.siblingWrites).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 2 },
      { id: "d", order: 3 },
    ]);
  });

  it("produces a contiguous run with no duplicate positions", () => {
    const plan = planColumnOrder("b", ["a", "b", "c", "d"], siblings, 0);
    const positions = [
      plan.resolvedOrder,
      ...plan.siblingWrites.map((w) => w.order),
    ].sort((x, y) => x - y);
    expect(positions).toEqual([0, 1, 2, 3]);
  });

  it("keeps the relative order of the issues that did not move", () => {
    const plan = planColumnOrder("a", ["b", "c", "a", "d"], siblings, 0);
    expect(plan.siblingWrites.map((w) => w.id)).toEqual(["b", "c", "d"]);
    expect(plan.resolvedOrder).toBe(2);
  });

  it("handles a move into an empty column", () => {
    const plan = planColumnOrder("a", ["a"], [], 0);
    expect(plan).toEqual({ resolvedOrder: 0, siblingWrites: [] });
  });

  it("falls back to the supplied index when no column listing is given", () => {
    expect(planColumnOrder("a", undefined, siblings, 7)).toEqual({
      resolvedOrder: 7,
      siblingWrites: [],
    });
    expect(planColumnOrder("a", [], siblings, 3).resolvedOrder).toBe(3);
  });

  // The listing arrives from the browser, so it cannot be trusted to name only
  // issues the caller may reorder.
  it("ignores ids that were not verified as siblings", () => {
    const plan = planColumnOrder(
      "c",
      ["c", "a", "issue-from-another-project", "b"],
      ["a", "b"],
      0
    );
    expect(plan.resolvedOrder).toBe(0);
    expect(plan.siblingWrites).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("ignores a repeated id rather than giving it two positions", () => {
    const plan = planColumnOrder("a", ["a", "b", "b", "c"], siblings, 0);
    expect(plan.siblingWrites).toEqual([
      { id: "b", order: 1 },
      { id: "c", order: 2 },
    ]);
  });

  it("never writes a position for the moved issue twice", () => {
    const plan = planColumnOrder("a", ["b", "a", "c", "a"], siblings, 0);
    expect(plan.siblingWrites.some((w) => w.id === "a")).toBe(false);
    expect(plan.resolvedOrder).toBe(1);
  });

  it("does not care how long the column is", () => {
    const many = Array.from({ length: 200 }, (_, i) => `i${i}`);
    const plan = planColumnOrder("i150", ["i150", ...many.filter((i) => i !== "i150")], many, 0);
    expect(plan.resolvedOrder).toBe(0);
    expect(plan.siblingWrites).toHaveLength(199);
    expect(plan.siblingWrites.at(-1)).toEqual({ id: "i199", order: 199 });
  });
});

describe("the ordering contract the board relies on", () => {
  // The server sorts by order then createdAt ascending and the client repeats
  // that sort. They disagreed before, so equal-order issues swapped on load.
  it("leaves no two issues sharing a position after a drop", () => {
    const plan = planColumnOrder("c", ["c", "a", "b", "d"], siblings, 0);
    const all = [
      { id: "c", order: plan.resolvedOrder },
      ...plan.siblingWrites,
    ];
    expect(new Set(all.map((e) => e.order)).size).toBe(all.length);
  });
});
