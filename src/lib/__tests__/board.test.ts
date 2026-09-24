import { describe, expect, it } from "vitest";
import {
  backlogMoveTargets,
  boardFiltersToTQL,
  hasBoardFilters,
  matchesBoardFilters,
  moveTargets,
  NO_BOARD_FILTERS,
  sprintProgress,
  sprintTimeLeft,
  wipState,
} from "@/lib/board";
import { EMPTY_SELECTION, extendSelection, pruneSelection, toggleSelection } from "@/lib/selection";
import { TQLParser } from "@/lib/tql/parser";

const statuses = [
  { id: "s1", name: "TODO", category: "TODO" },
  { id: "s2", name: "IN_PROGRESS", category: "IN_PROGRESS" },
  { id: "s3", name: "IN_REVIEW", category: "IN_PROGRESS" },
  { id: "s4", name: "DONE", category: "DONE" },
];

describe("sprintProgress", () => {
  it("counts issues and points by status category", () => {
    const p = sprintProgress(
      [
        { status: "TODO", storyPoints: 3 },
        { status: "IN_PROGRESS", storyPoints: 5 },
        { status: "IN_REVIEW", storyPoints: null },
        { status: "DONE", storyPoints: 2 },
        { status: "SOMETHING_ELSE", storyPoints: 1 },
      ],
      statuses
    );
    expect(p.issues).toEqual({ TODO: 2, IN_PROGRESS: 2, DONE: 1 });
    expect(p.points).toEqual({ TODO: 4, IN_PROGRESS: 5, DONE: 2 });
    expect(p.totalIssues).toBe(5);
    expect(p.totalPoints).toBe(11);
  });
});

describe("sprintTimeLeft", () => {
  const now = new Date(2026, 8, 24, 15, 0);
  it("says how long is left, by calendar day", () => {
    expect(sprintTimeLeft(new Date(2026, 9, 8), now)).toBe("14 days left");
    expect(sprintTimeLeft(new Date(2026, 8, 25, 1), now)).toBe("1 day left");
    expect(sprintTimeLeft(new Date(2026, 8, 24, 23), now)).toBe("Ends today");
    expect(sprintTimeLeft(new Date(2026, 8, 23), now)).toBe("1 day over");
    expect(sprintTimeLeft(new Date(2026, 8, 20), now)).toBe("4 days over");
    expect(sprintTimeLeft(null, now)).toBeNull();
  });
});

describe("wipState", () => {
  it("is amber at the limit and red over it", () => {
    expect(wipState(3, null)).toBe("none");
    expect(wipState(3, 4)).toBe("under");
    expect(wipState(4, 4)).toBe("at");
    expect(wipState(5, 4)).toBe("over");
  });
});

describe("moveTargets", () => {
  const columns = statuses.map((s) => ({ id: s.name, title: s.name }));
  it("offers only the columns the workflow allows, never the current one", () => {
    const transitions = [
      { fromId: "s1", toId: "s2" },
      { fromId: "s2", toId: "s3" },
      { fromId: "s2", toId: "s1" },
    ];
    expect(moveTargets("TODO", columns, statuses, transitions).map((c) => c.id)).toEqual(["IN_PROGRESS"]);
    expect(moveTargets("IN_PROGRESS", columns, statuses, transitions).map((c) => c.id)).toEqual(["TODO", "IN_REVIEW"]);
  });

  it("offers every other column while the workflow hasn't loaded", () => {
    expect(moveTargets("TODO", columns, statuses, []).map((c) => c.id)).toEqual(["IN_PROGRESS", "IN_REVIEW", "DONE"]);
  });
});

describe("board filters", () => {
  const issue = { assigneeId: "u1", type: "BUG" as const, priority: "HIGH" as const };

  it("passes everything with no chips set", () => {
    expect(hasBoardFilters(NO_BOARD_FILTERS)).toBe(false);
    expect(matchesBoardFilters(issue, NO_BOARD_FILTERS)).toBe(true);
  });

  it("combines chips with AND, values within a chip with OR", () => {
    const f = { ...NO_BOARD_FILTERS, types: ["BUG" as const, "TASK" as const], priorities: ["HIGH" as const] };
    expect(matchesBoardFilters(issue, f)).toBe(true);
    expect(matchesBoardFilters({ ...issue, priority: "LOW" }, f)).toBe(false);
    expect(matchesBoardFilters(issue, { ...NO_BOARD_FILTERS, assigneeIds: ["u2"] })).toBe(false);
    expect(matchesBoardFilters({ ...issue, assigneeId: null }, { ...NO_BOARD_FILTERS, assigneeIds: ["u1"] })).toBe(false);
  });

  it("'only mine' needs someone signed in", () => {
    const mine = { ...NO_BOARD_FILTERS, onlyMine: true };
    expect(matchesBoardFilters(issue, mine, "u1")).toBe(true);
    expect(matchesBoardFilters(issue, mine, "u2")).toBe(false);
    expect(matchesBoardFilters(issue, mine, null)).toBe(false);
  });

  it("writes the chips as a TQL query the Issues page can parse", () => {
    const tql = boardFiltersToTQL(
      "APOLLO",
      { assigneeIds: ["u1", "u2"], types: ["BUG"], priorities: ["HIGH", "HIGHEST"], onlyMine: true },
      { sprintOnly: true }
    );
    expect(tql).toBe(
      'project = "APOLLO" AND sprint in openSprints() AND assignee = currentUser() AND assignee in ("u1", "u2") AND type = "BUG" AND priority in ("HIGH", "HIGHEST")'
    );
    expect(TQLParser.parse(tql).success).toBe(true);
    expect(boardFiltersToTQL('A"B', NO_BOARD_FILTERS, { sprintOnly: false })).toBe('project = "A\\"B"');
  });
});

describe("backlogMoveTargets", () => {
  const sprints = [
    { id: "f1", name: "Sprint 3", status: "FUTURE" },
    { id: "a1", name: "Sprint 2", status: "ACTIVE" },
    { id: "c1", name: "Sprint 1", status: "COMPLETED" },
  ];
  it("lists the active sprint first, then planned ones, then the backlog", () => {
    expect(backlogMoveTargets({ sprintId: "f1", type: "TASK" }, sprints, false)).toEqual([
      { id: "a1", label: "Sprint 2", active: true },
      { id: null, label: "Backlog" },
    ]);
  });
});

describe("selection", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("toggles one row and remembers it as the anchor", () => {
    const s = toggleSelection(EMPTY_SELECTION, "b");
    expect([...s.ids]).toEqual(["b"]);
    expect(s.anchor).toBe("b");
    expect([...toggleSelection(s, "b").ids]).toEqual([]);
  });

  it("extends from the anchor to the clicked row, either way", () => {
    const s = toggleSelection(EMPTY_SELECTION, "b");
    expect([...extendSelection(s, "d", order).ids].sort()).toEqual(["b", "c", "d"]);
    expect([...extendSelection(toggleSelection(EMPTY_SELECTION, "d"), "a", order).ids].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("selects just the row when the anchor isn't in this list", () => {
    const s = toggleSelection(EMPTY_SELECTION, "x");
    expect([...extendSelection(s, "c", order).ids].sort()).toEqual(["c", "x"]);
  });

  it("drops rows that are no longer shown", () => {
    const s = extendSelection(toggleSelection(EMPTY_SELECTION, "a"), "c", order);
    const pruned = pruneSelection(s, ["b", "c"]);
    expect([...pruned.ids].sort()).toEqual(["b", "c"]);
    expect(pruned.anchor).toBeNull();
    expect(pruneSelection(pruned, ["b", "c"])).toBe(pruned);
  });
});
