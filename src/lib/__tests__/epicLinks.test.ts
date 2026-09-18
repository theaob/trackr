import { describe, expect, it } from "vitest";

describe("Epic hierarchy and linking", () => {
  const epicA = { id: "epic-a", key: "EPIC-1", title: "Core Platform", type: "EPIC", parentId: null };
  const epicB = { id: "epic-b", key: "EPIC-2", title: "Auth Framework", type: "EPIC", parentId: null };
  const epicC = { id: "epic-c", key: "EPIC-3", title: "OAuth SSO", type: "EPIC", parentId: null };
  const story1 = { id: "story-1", key: "EPIC-4", title: "Login button", type: "STORY", parentId: "epic-b" };

  it("allows selecting another epic as parent, excluding self and direct children", () => {
    const currentEpic = { ...epicB, children: [epicC, story1] };
    const allIssues = [epicA, epicB, epicC, story1];

    const childIds = new Set((currentEpic.children || []).map((c) => c.id));
    const candidateEpics = allIssues.filter(
      (i) => i.type === "EPIC" && i.id !== currentEpic.id && !childIds.has(i.id)
    );

    // epicA should be a valid parent candidate for epicB
    expect(candidateEpics.map((e) => e.id)).toEqual(["epic-a"]);
    // self (epicB) and child (epicC) must be excluded
    expect(candidateEpics.map((e) => e.id)).not.toContain("epic-b");
    expect(candidateEpics.map((e) => e.id)).not.toContain("epic-c");
  });

  it("detects circular parenting loops", () => {
    // A -> B -> C. Setting C as parent of A would cause a cycle.
    const hierarchy = new Map<string, string | null>([
      ["epic-a", null],
      ["epic-b", "epic-a"],
      ["epic-c", "epic-b"],
    ]);

    function wouldCauseCycle(targetId: string, proposedParentId: string): boolean {
      if (targetId === proposedParentId) return true;
      let cur: string | null | undefined = proposedParentId;
      while (cur) {
        if (cur === targetId) return true;
        cur = hierarchy.get(cur) ?? null;
      }
      return false;
    }

    expect(wouldCauseCycle("epic-a", "epic-c")).toBe(true);
    expect(wouldCauseCycle("epic-a", "epic-b")).toBe(true);
    expect(wouldCauseCycle("epic-c", "epic-a")).toBe(false);
  });
});
