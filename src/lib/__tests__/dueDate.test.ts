import { describe, expect, it } from "vitest";
import { isOverdue } from "@/lib/dueDate";

const DONE = ["DONE"];

describe("isOverdue", () => {
  it("is false when there is no due date", () => {
    expect(isOverdue(null, "TODO", DONE)).toBe(false);
    expect(isOverdue(undefined, "TODO", DONE)).toBe(false);
  });

  it("is true for a past due date on an unfinished issue", () => {
    expect(isOverdue("2000-01-01", "TODO", DONE)).toBe(true);
  });

  it("is false for a future due date", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    expect(isOverdue(future, "TODO", DONE)).toBe(false);
  });

  it("is false once the issue is in a done-category status, even if past due", () => {
    expect(isOverdue("2000-01-01", "DONE", DONE)).toBe(false);
  });
});
