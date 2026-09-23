import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  UNSET_STATUS_COLOR,
  defaultStatusColor,
  isDefaultStatusColor,
  stackingOrder,
} from "@/lib/statusColors";

describe("defaultStatusColor", () => {
  it("gives a status its category's color", () => {
    expect(defaultStatusColor("IN_PROGRESS")).toBe(CATEGORY_COLORS.IN_PROGRESS);
    expect(defaultStatusColor("DONE")).toBe(CATEGORY_COLORS.DONE);
    expect(defaultStatusColor("nonsense")).toBe(CATEGORY_COLORS.TODO);
  });
});

describe("isDefaultStatusColor", () => {
  it("treats the old gray and the category color as defaults", () => {
    expect(isDefaultStatusColor(UNSET_STATUS_COLOR, "IN_PROGRESS")).toBe(true);
    expect(isDefaultStatusColor(CATEGORY_COLORS.IN_PROGRESS.toLowerCase(), "IN_PROGRESS")).toBe(true);
  });

  it("treats a color someone picked as theirs, even the same gray from the picker", () => {
    expect(isDefaultStatusColor("#ff8800", "IN_PROGRESS")).toBe(false);
    expect(isDefaultStatusColor(UNSET_STATUS_COLOR.toLowerCase(), "IN_PROGRESS")).toBe(false);
  });
});

describe("stackingOrder", () => {
  it("puts done work first, then later stages before earlier ones", () => {
    const statuses = [
      { name: "Backlog", category: "TODO", order: 0 },
      { name: "To Do", category: "TODO", order: 1 },
      { name: "In Progress", category: "IN_PROGRESS", order: 2 },
      { name: "QA", category: "IN_PROGRESS", order: 3 },
      { name: "Done", category: "DONE", order: 4 },
      // A custom status added last but belonging to In Progress.
      { name: "Blocked", category: "IN_PROGRESS", order: 5 },
    ];
    expect(stackingOrder(statuses).map((s) => s.name)).toEqual([
      "Done",
      "Blocked",
      "QA",
      "In Progress",
      "To Do",
      "Backlog",
    ]);
  });
});
