import { describe, expect, it } from "vitest";
import { allowedNextStatusNames, prettifyStatusName } from "@/lib/workflowDisplay";

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
