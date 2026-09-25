import { describe, expect, it } from "vitest";
import {
  boardLayout,
  everyTransition,
  moveItem,
  statusFlows,
  statusWarnings,
  withStatusTransitions,
} from "@/lib/workflowEditor";

const s = (id: string, order: number, category = "TODO", isBacklog = false) => ({ id, name: id, category, isBacklog, order });
const statuses = [s("backlog", 0, "TODO", true), s("todo", 1), s("doing", 2, "IN_PROGRESS"), s("done", 3, "DONE")];

describe("workflow editor helpers", () => {
  it("lists each status's moves in workflow order, and notices when they cover every status", () => {
    const flows = statusFlows(statuses, [
      ...everyTransition(statuses).filter((t) => t.toId === "done"),
      { fromId: "todo", toId: "doing" },
      { fromId: "todo", toId: "backlog" },
    ]);
    expect(flows.get("todo")).toEqual({ to: ["backlog", "doing", "done"], from: [], toAll: true, fromAll: false });
    expect(flows.get("done")).toMatchObject({ to: [], fromAll: true });
  });

  it("warns about a status nothing leads to, and one issues can't leave unless it's done", () => {
    const flows = statusFlows(statuses, [
      { fromId: "todo", toId: "doing" },
      { fromId: "doing", toId: "done" },
    ]);
    expect(statusWarnings(statuses[1], flows.get("todo"), 4)).toEqual(["No status leads here"]);
    expect(statusWarnings(statuses[3], flows.get("done"), 4)).toEqual([]);
    expect(statusWarnings(statuses[0], flows.get("backlog"), 4)).toEqual([
      "No status leads here",
      "Issues here can't move on",
    ]);
    // A one-status workflow has nothing to connect.
    expect(statusWarnings(statuses[0], statusFlows([statuses[0]], []).get("backlog"), 1)).toEqual([]);
  });

  it("splits the board's columns from the backlog-only statuses, in order", () => {
    const { columns, backlog } = boardLayout([statuses[3], statuses[0], statuses[2], statuses[1]]);
    expect(columns.map((c) => c.id)).toEqual(["todo", "doing", "done"]);
    expect(backlog.map((c) => c.id)).toEqual(["backlog"]);
  });

  it("gives one status new moves both ways and leaves the others' alone", () => {
    const before = [
      { fromId: "todo", toId: "doing" },
      { fromId: "doing", toId: "done" },
      { fromId: "backlog", toId: "todo" },
    ];
    const after = withStatusTransitions(before, "doing", ["todo", "doing"], ["backlog"]);
    expect(after).toEqual([
      { fromId: "backlog", toId: "todo" },
      { fromId: "doing", toId: "todo" },
      { fromId: "backlog", toId: "doing" },
    ]);
  });

  it("has every move between two different statuses", () => {
    expect(everyTransition(statuses)).toHaveLength(12);
    expect(everyTransition(statuses).some((t) => t.fromId === t.toId)).toBe(false);
  });

  it("moves an item within a list and ignores moves out of range", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    const same = ["a", "b"];
    expect(moveItem(same, 0, 5)).toBe(same);
  });
});
