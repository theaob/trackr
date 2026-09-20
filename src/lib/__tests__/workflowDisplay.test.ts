import { describe, expect, it } from "vitest";
import {
  allowedNextStatusNames,
  prettifyStatusName,
  isDoneStatus,
  getDoneStatusNames,
} from "@/lib/workflowDisplay";

describe("prettifyStatusName", () => {
  it("uses the exact legacy label for each of the five original statuses", () => {
    expect(prettifyStatusName("BACKLOG")).toBe("Backlog");
    expect(prettifyStatusName("TODO")).toBe("To Do");
    expect(prettifyStatusName("IN_PROGRESS")).toBe("In Progress");
    expect(prettifyStatusName("IN_REVIEW")).toBe("In Review");
    expect(prettifyStatusName("DONE")).toBe("Done");
  });

  it("turns an unrecognized SHOUTING_SNAKE_CASE name into spaced words", () => {
    expect(prettifyStatusName("READY_FOR_QA")).toBe("READY FOR QA");
  });

  it("leaves a free-text custom status name untouched", () => {
    expect(prettifyStatusName("Code Review")).toBe("Code Review");
    expect(prettifyStatusName("QA")).toBe("QA");
  });

  it("passes through an empty string", () => {
    expect(prettifyStatusName("")).toBe("");
  });

  it("handles null and undefined safely without throwing", () => {
    expect(prettifyStatusName(null)).toBe("");
    expect(prettifyStatusName(undefined)).toBe("");
  });
});

describe("allowedNextStatusNames", () => {
  const statuses = [
    { id: "s1", name: "TODO" },
    { id: "s2", name: "IN_PROGRESS" },
    { id: "s3", name: "DONE" },
  ];

  it("always includes the current status", () => {
    const names = allowedNextStatusNames("TODO", statuses, []);
    expect(names).toEqual(["TODO"]);
  });

  it("includes every status reachable by a configured transition", () => {
    const transitions = [
      { fromId: "s1", toId: "s2" },
      { fromId: "s1", toId: "s3" },
      { fromId: "s2", toId: "s3" },
    ];
    const names = allowedNextStatusNames("TODO", statuses, transitions);
    expect(new Set(names)).toEqual(new Set(["TODO", "IN_PROGRESS", "DONE"]));
  });

  it("matches current status case-insensitively", () => {
    const transitions = [
      { fromId: "s1", toId: "s2" },
      { fromId: "s1", toId: "s3" },
    ];
    const names = allowedNextStatusNames("todo", statuses, transitions);
    expect(new Set(names)).toEqual(new Set(["todo", "IN_PROGRESS", "DONE"]));
  });

  it("excludes a transition that starts from a different status", () => {
    const transitions = [{ fromId: "s2", toId: "s3" }];
    const names = allowedNextStatusNames("TODO", statuses, transitions);
    expect(names).toEqual(["TODO"]);
  });

  it("falls back to just the current name when it isn't a known status", () => {
    const names = allowedNextStatusNames("MADE_UP", statuses, [{ fromId: "s1", toId: "s2" }]);
    expect(names).toEqual(["MADE_UP"]);
  });
});

describe("isDoneStatus", () => {
  const workflowStatuses = [
    { name: "TODO", category: "TODO" },
    { name: "IN_PROGRESS", category: "IN_PROGRESS" },
    { name: "DONE", category: "DONE" },
    { name: "Delivered", category: "DONE" },
    { name: "Archived", category: "DONE" },
  ];

  it("returns true for exact and case-insensitive matches with category DONE", () => {
    expect(isDoneStatus("DONE", workflowStatuses)).toBe(true);
    expect(isDoneStatus("done", workflowStatuses)).toBe(true);
    expect(isDoneStatus("Done", workflowStatuses)).toBe(true);
    expect(isDoneStatus("Delivered", workflowStatuses)).toBe(true);
    expect(isDoneStatus("delivered", workflowStatuses)).toBe(true);
    expect(isDoneStatus("Archived", workflowStatuses)).toBe(true);
  });

  it("returns false for non-done categories", () => {
    expect(isDoneStatus("TODO", workflowStatuses)).toBe(false);
    expect(isDoneStatus("IN_PROGRESS", workflowStatuses)).toBe(false);
    expect(isDoneStatus("in_progress", workflowStatuses)).toBe(false);
  });

  it("falls back to standard done aliases when workflow statuses are absent or missing", () => {
    expect(isDoneStatus("DONE")).toBe(true);
    expect(isDoneStatus("Done")).toBe(true);
    expect(isDoneStatus("done")).toBe(true);
    expect(isDoneStatus("CLOSED")).toBe(true);
    expect(isDoneStatus("Closed")).toBe(true);
    expect(isDoneStatus("RESOLVED")).toBe(true);
    expect(isDoneStatus("Resolved")).toBe(true);
    expect(isDoneStatus("COMPLETED")).toBe(true);
    expect(isDoneStatus("Completed")).toBe(true);
    expect(isDoneStatus("FINISHED")).toBe(true);
    expect(isDoneStatus("Finished")).toBe(true);
    expect(isDoneStatus("TODO")).toBe(false);
    expect(isDoneStatus(null)).toBe(false);
    expect(isDoneStatus(undefined)).toBe(false);
  });
});

describe("getDoneStatusNames", () => {
  it("includes all statuses with category DONE and standard fallbacks", () => {
    const workflowStatuses = [
      { name: "CustomDone", category: "DONE" },
      { name: "InDev", category: "IN_PROGRESS" },
    ];
    const names = getDoneStatusNames(workflowStatuses);
    expect(names).toContain("CustomDone");
    expect(names).toContain("DONE");
    expect(names).toContain("CLOSED");
    expect(names).not.toContain("InDev");
  });
});
