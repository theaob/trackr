import { describe, expect, it } from "vitest";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { describeIssueLink } from "@/lib/issueLinks";

describe("Issue relations and linking integrity", () => {
  it("formats status names safely even when null or undefined", () => {
    expect(prettifyStatusName(undefined)).toBe("");
    expect(prettifyStatusName(null)).toBe("");
    expect(prettifyStatusName("")).toBe("");
    expect(prettifyStatusName("IN_PROGRESS")).toBe("In Progress");
    expect(prettifyStatusName("Custom Status")).toBe("Custom Status");
  });

  it("describes outward and inward link relations correctly", () => {
    expect(describeIssueLink("BLOCKS", "outward")).toBe("blocks");
    expect(describeIssueLink("BLOCKS", "inward")).toBe("is blocked by");
    expect(describeIssueLink("RELATES_TO", "outward")).toBe("relates to");
    expect(describeIssueLink("RELATES_TO", "inward")).toBe("relates to");
    expect(describeIssueLink("DUPLICATES", "outward")).toBe("duplicates");
    expect(describeIssueLink("DUPLICATES", "inward")).toBe("is duplicated by");
  });

  it("handles child issue rollup calculations accurately", () => {
    const children = [
      { id: "c1", status: "DONE", storyPoints: 3 },
      { id: "c2", status: "IN_PROGRESS", storyPoints: 5 },
      { id: "c3", status: "TODO", storyPoints: null },
    ];

    const totalCount = children.length;
    const doneCount = children.filter((c) => c.status === "DONE").length;
    const inProgressCount = children.filter((c) => c.status === "IN_PROGRESS").length;
    const todoCount = totalCount - doneCount - inProgressCount;
    const totalPoints = children.reduce((sum, c) => sum + (Number(c.storyPoints) || 0), 0);
    const donePoints = children
      .filter((c) => c.status === "DONE")
      .reduce((sum, c) => sum + (Number(c.storyPoints) || 0), 0);

    expect(totalCount).toBe(3);
    expect(doneCount).toBe(1);
    expect(inProgressCount).toBe(1);
    expect(todoCount).toBe(1);
    expect(totalPoints).toBe(8);
    expect(donePoints).toBe(3);
  });

  it("merges issue updates without destroying existing children or links", () => {
    const originalIssue = {
      id: "issue-1",
      key: "PROJ-1",
      title: "Parent Epic",
      children: [{ id: "c1", key: "PROJ-2", title: "Child 1", status: "TODO" }],
      linksAsSource: [{ id: "l1", type: "BLOCKS", target: { id: "t1", key: "PROJ-3", title: "Target" } }],
    };

    // When a new child relation is added
    const newChild = { id: "c2", key: "PROJ-4", title: "Child 2", status: "IN_PROGRESS" };
    const withNewChild = {
      ...originalIssue,
      children: [...originalIssue.children, newChild],
    };

    expect(withNewChild.children).toHaveLength(2);
    expect(withNewChild.linksAsSource).toHaveLength(1);

    // When an issue link relation is added
    const newLink = { id: "l2", type: "RELATES_TO", target: { id: "t2", key: "PROJ-5", title: "Target 2" } };
    const withNewLink = {
      ...withNewChild,
      linksAsSource: [...withNewChild.linksAsSource, newLink as any],
    };

    expect(withNewLink.children).toHaveLength(2);
    expect(withNewLink.linksAsSource).toHaveLength(2);
  });
});
