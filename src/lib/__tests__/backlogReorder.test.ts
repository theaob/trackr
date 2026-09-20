import { describe, it, expect } from "vitest";
import { planColumnOrder } from "@/lib/boardOrder";

describe("Backlog Reordering Logic", () => {
  const siblings = ["task-1", "task-2", "task-3", "task-4"];

  describe("Reordering within Backlog / Sprint container", () => {
    it("moves an issue to the top of the container", () => {
      // User drags task-3 to index 0: ['task-3', 'task-1', 'task-2', 'task-4']
      const reorderedIds = ["task-3", "task-1", "task-2", "task-4"];
      const plan = planColumnOrder("task-3", reorderedIds, siblings, 0);

      expect(plan.resolvedOrder).toBe(0);
      expect(plan.siblingWrites).toEqual([
        { id: "task-1", order: 1 },
        { id: "task-2", order: 2 },
        { id: "task-4", order: 3 },
      ]);
    });

    it("moves an issue to the bottom of the container", () => {
      // User drags task-2 to the end: ['task-1', 'task-3', 'task-4', 'task-2']
      const reorderedIds = ["task-1", "task-3", "task-4", "task-2"];
      const plan = planColumnOrder("task-2", reorderedIds, siblings, 3);

      expect(plan.resolvedOrder).toBe(3);
      expect(plan.siblingWrites).toEqual([
        { id: "task-1", order: 0 },
        { id: "task-3", order: 1 },
        { id: "task-4", order: 2 },
      ]);
    });

    it("moves an issue into an intermediate position", () => {
      // User drags task-4 between task-1 and task-2: ['task-1', 'task-4', 'task-2', 'task-3']
      const reorderedIds = ["task-1", "task-4", "task-2", "task-3"];
      const plan = planColumnOrder("task-4", reorderedIds, siblings, 1);

      expect(plan.resolvedOrder).toBe(1);
      expect(plan.siblingWrites).toEqual([
        { id: "task-1", order: 0 },
        { id: "task-2", order: 2 },
        { id: "task-3", order: 3 },
      ]);
    });
  });

  describe("Cross-container move (Backlog <-> Sprint)", () => {
    const sprintSiblings = ["sprint-item-1", "sprint-item-2"];
    const movingBacklogId = "backlog-item-9";

    it("places moved item at top of sprint", () => {
      const targetList = [movingBacklogId, ...sprintSiblings];
      const plan = planColumnOrder(
        movingBacklogId,
        targetList,
        sprintSiblings,
        0
      );

      expect(plan.resolvedOrder).toBe(0);
      expect(plan.siblingWrites).toEqual([
        { id: "sprint-item-1", order: 1 },
        { id: "sprint-item-2", order: 2 },
      ]);
    });

    it("places moved item at bottom of sprint", () => {
      const targetList = [...sprintSiblings, movingBacklogId];
      const plan = planColumnOrder(
        movingBacklogId,
        targetList,
        sprintSiblings,
        2
      );

      expect(plan.resolvedOrder).toBe(2);
      expect(plan.siblingWrites).toEqual([
        { id: "sprint-item-1", order: 0 },
        { id: "sprint-item-2", order: 1 },
      ]);
    });

    it("places moved item into empty sprint", () => {
      const plan = planColumnOrder(movingBacklogId, [movingBacklogId], [], 0);

      expect(plan.resolvedOrder).toBe(0);
      expect(plan.siblingWrites).toEqual([]);
    });

    it("filters out rogue unverified IDs", () => {
      // Rogue ID from another project should be stripped
      const targetList = ["sprint-item-1", movingBacklogId, "rogue-other-project", "sprint-item-2"];
      const plan = planColumnOrder(
        movingBacklogId,
        targetList,
        sprintSiblings, // only sprint-item-1 and sprint-item-2 are valid
        1
      );

      expect(plan.resolvedOrder).toBe(1);
      expect(plan.siblingWrites).toEqual([
        { id: "sprint-item-1", order: 0 },
        { id: "sprint-item-2", order: 2 },
      ]);
    });
  });

  describe("Filter and Reorder Disabling Logic", () => {
    function computeIsFiltered(searchQuery: string, selectedEpicId: string): boolean {
      return Boolean(searchQuery.trim() || selectedEpicId !== "ALL");
    }

    function canDrag(canMoveIssue: boolean, isFiltered: boolean): boolean {
      return canMoveIssue && !isFiltered;
    }

    it("allows drag when user has permission and no filters are active", () => {
      const isFiltered = computeIsFiltered("", "ALL");
      expect(isFiltered).toBe(false);
      expect(canDrag(true, isFiltered)).toBe(true);
    });

    it("disables drag when search query is typed", () => {
      const isFiltered = computeIsFiltered("login", "ALL");
      expect(isFiltered).toBe(true);
      expect(canDrag(true, isFiltered)).toBe(false);
    });

    it("disables drag when search query has only whitespace", () => {
      const isFiltered = computeIsFiltered("   ", "ALL");
      expect(isFiltered).toBe(false);
      expect(canDrag(true, isFiltered)).toBe(true);
    });

    it("disables drag when an epic filter is selected", () => {
      const isFiltered = computeIsFiltered("", "epic-123");
      expect(isFiltered).toBe(true);
      expect(canDrag(true, isFiltered)).toBe(false);
    });

    it("disables drag when user lacks canMoveIssue permission", () => {
      expect(canDrag(false, false)).toBe(false);
    });
  });

  describe("Deterministic Sorting by Order and Creation Date", () => {
    type TestIssue = {
      id: string;
      order: number | null;
      createdAt: string;
    };

    const sortIssues = (a: TestIssue, b: TestIssue) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    it("sorts by explicit order values ascending", () => {
      const issues: TestIssue[] = [
        { id: "b", order: 2, createdAt: "2026-01-01" },
        { id: "a", order: 0, createdAt: "2026-01-02" },
        { id: "c", order: 1, createdAt: "2026-01-03" },
      ];

      const sorted = [...issues].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["a", "c", "b"]);
    });

    it("breaks ties with createdAt when order is equal", () => {
      const issues: TestIssue[] = [
        { id: "newer", order: 0, createdAt: "2026-01-02T10:00:00Z" },
        { id: "older", order: 0, createdAt: "2026-01-01T10:00:00Z" },
      ];

      const sorted = [...issues].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["older", "newer"]);
    });

    it("defaults null order to 0", () => {
      const issues: TestIssue[] = [
        { id: "has-order", order: 1, createdAt: "2026-01-01" },
        { id: "no-order", order: null, createdAt: "2026-01-02" },
      ];

      const sorted = [...issues].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["no-order", "has-order"]);
    });
  });

  describe("New Issue Insertion Order After Reordering", () => {
    type TestIssue = {
      id: string;
      order: number;
      createdAt: string;
    };

    const sortIssues = (a: TestIssue, b: TestIssue) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    function computeNextOrder(containerIssues: { order?: number | null }[]): number {
      const maxOrder = containerIssues.reduce(
        (max, item) => Math.max(max, item.order ?? 0),
        -1
      );
      return maxOrder + 1;
    }

    it("demonstrates the bug: creating an issue with default order 0 inserts behind the moved item", () => {
      // Suppose we had task-1 and task-2. User moved task-2 to the top.
      // Reordered list: [task-2 (order: 0), task-1 (order: 1)]
      const reorderedBacklog: TestIssue[] = [
        { id: "task-2", order: 0, createdAt: "2026-01-02T10:00:00Z" },
        { id: "task-1", order: 1, createdAt: "2026-01-01T10:00:00Z" },
      ];

      // A new item created with default order 0
      const buggyNewItem: TestIssue = {
        id: "task-new",
        order: 0,
        createdAt: "2026-01-03T12:00:00Z",
      };

      const sorted = [...reorderedBacklog, buggyNewItem].sort(sortIssues);
      // Buggy behavior: task-new lands at index 1 (behind task-2), NOT at the bottom!
      expect(sorted.map((i) => i.id)).toEqual(["task-2", "task-new", "task-1"]);
    });

    it("inserts new item at the bottom after an issue is moved to the top", () => {
      const reorderedBacklog: TestIssue[] = [
        { id: "task-3", order: 0, createdAt: "2026-01-03T10:00:00Z" },
        { id: "task-1", order: 1, createdAt: "2026-01-01T10:00:00Z" },
        { id: "task-2", order: 2, createdAt: "2026-01-02T10:00:00Z" },
      ];

      const nextOrder = computeNextOrder(reorderedBacklog);
      expect(nextOrder).toBe(3);

      const newItem: TestIssue = {
        id: "task-new",
        order: nextOrder,
        createdAt: "2026-01-04T12:00:00Z",
      };

      const sorted = [...reorderedBacklog, newItem].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["task-3", "task-1", "task-2", "task-new"]);
      expect(sorted.at(-1)?.id).toBe("task-new");
    });

    it("inserts new item at the bottom after an issue is moved to the bottom", () => {
      const reorderedBacklog: TestIssue[] = [
        { id: "task-2", order: 0, createdAt: "2026-01-02T10:00:00Z" },
        { id: "task-3", order: 1, createdAt: "2026-01-03T10:00:00Z" },
        { id: "task-1", order: 2, createdAt: "2026-01-01T10:00:00Z" },
      ];

      const nextOrder = computeNextOrder(reorderedBacklog);
      expect(nextOrder).toBe(3);

      const newItem: TestIssue = {
        id: "task-new",
        order: nextOrder,
        createdAt: "2026-01-04T12:00:00Z",
      };

      const sorted = [...reorderedBacklog, newItem].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["task-2", "task-3", "task-1", "task-new"]);
      expect(sorted.at(-1)?.id).toBe("task-new");
    });

    it("supports multiple sequential issue creations after reordering", () => {
      let backlog: TestIssue[] = [
        { id: "task-2", order: 0, createdAt: "2026-01-02T10:00:00Z" },
        { id: "task-1", order: 1, createdAt: "2026-01-01T10:00:00Z" },
      ];

      // Create item A
      const orderA = computeNextOrder(backlog);
      expect(orderA).toBe(2);
      backlog = [...backlog, { id: "task-3", order: orderA, createdAt: "2026-01-03T10:00:00Z" }].sort(sortIssues);

      // Create item B
      const orderB = computeNextOrder(backlog);
      expect(orderB).toBe(3);
      backlog = [...backlog, { id: "task-4", order: orderB, createdAt: "2026-01-04T10:00:00Z" }].sort(sortIssues);

      expect(backlog.map((i) => i.id)).toEqual(["task-2", "task-1", "task-3", "task-4"]);
    });

    it("handles empty container by returning order 0", () => {
      const nextOrder = computeNextOrder([]);
      expect(nextOrder).toBe(0);
    });

    it("handles legacy backlog where all items have order 0", () => {
      const legacyBacklog: TestIssue[] = [
        { id: "task-1", order: 0, createdAt: "2026-01-01T10:00:00Z" },
        { id: "task-2", order: 0, createdAt: "2026-01-02T10:00:00Z" },
      ];

      const nextOrder = computeNextOrder(legacyBacklog);
      expect(nextOrder).toBe(1);

      const newItem: TestIssue = {
        id: "task-3",
        order: nextOrder,
        createdAt: "2026-01-03T10:00:00Z",
      };

      const sorted = [...legacyBacklog, newItem].sort(sortIssues);
      expect(sorted.map((i) => i.id)).toEqual(["task-1", "task-2", "task-3"]);
      expect(sorted.at(-1)?.id).toBe("task-3");
    });
  });
});
