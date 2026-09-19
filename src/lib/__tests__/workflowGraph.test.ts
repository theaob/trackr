import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowGraphView, {
  computeAutoLayout,
  calculateEdgePath,
  isTransitionFromAnyNode,
} from "@/components/settings/WorkflowGraphView";
import { WorkflowStatus, WorkflowTransition } from "@/types";

describe("WorkflowGraphView - Geometry and Layout", () => {
  const mockStatuses: WorkflowStatus[] = [
    {
      id: "s-todo",
      projectId: "p1",
      name: "To Do",
      category: "TODO",
      order: 0,
      isBacklog: false,
      color: "#64748B",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-in-progress",
      projectId: "p1",
      name: "In Progress",
      category: "IN_PROGRESS",
      order: 1,
      isBacklog: false,
      color: "#0052CC",
      wipLimit: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-in-review",
      projectId: "p1",
      name: "In Review",
      category: "IN_PROGRESS",
      order: 2,
      isBacklog: false,
      color: "#2684FF",
      wipLimit: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-done",
      projectId: "p1",
      name: "Done",
      category: "DONE",
      order: 3,
      isBacklog: false,
      color: "#059669",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("arranges statuses into 3 category columns: To Do, In Progress, and Done", () => {
    const layout = computeAutoLayout(mockStatuses);

    // TODO should be in col 0 (lowest x)
    expect(layout["s-todo"].x).toBeLessThan(layout["s-in-progress"].x);

    // IN_PROGRESS should be in col 1 (middle x)
    expect(layout["s-in-progress"].x).toBe(layout["s-in-review"].x);

    // Multiple statuses in IN_PROGRESS should stack vertically
    expect(layout["s-in-review"].y).toBeGreaterThan(layout["s-in-progress"].y);

    // DONE should be in col 2 (highest x)
    expect(layout["s-done"].x).toBeGreaterThan(layout["s-in-progress"].x);
  });

  it("calculates smooth forward Bézier curve for left-to-right transitions", () => {
    const fromPos = { x: 60, y: 60 };
    const toPos = { x: 400, y: 60 };

    const { path, midX, midY } = calculateEdgePath(fromPos, toPos, false, false);

    expect(path).toContain("M 270 103"); // fromPos.x + 210, fromPos.y + 43
    expect(path).toContain("C");
    expect(path).toContain("400 103");
    expect(midX).toBeGreaterThan(fromPos.x);
    expect(midX).toBeLessThan(toPos.x);
  });

  it("offsets bidirectional pairs so forward and reverse arrows do not collide", () => {
    const posA = { x: 60, y: 60 };
    const posB = { x: 400, y: 60 };

    const forward = calculateEdgePath(posA, posB, true, false);
    const reversePair = calculateEdgePath(posA, posB, true, true);

    // The control point curvature / midpoints should bow in opposite vertical directions
    expect(forward.midY).not.toBe(reversePair.midY);
    expect(forward.midY).toBeLessThan(reversePair.midY);
  });

  it("calculates a looped path for backward (right-to-left) transitions", () => {
    const posDone = { x: 740, y: 60 };
    const posInProgress = { x: 400, y: 60 };

    const { path } = calculateEdgePath(posDone, posInProgress, false, false);
    expect(path).toContain("M");
    expect(path).toContain("C");
  });
});

describe("WorkflowGraphView - Component Rendering", () => {
  const mockStatuses: WorkflowStatus[] = [
    {
      id: "s1",
      projectId: "p1",
      name: "Backlog",
      category: "TODO",
      order: 0,
      isBacklog: true,
      color: "#64748B",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s2",
      projectId: "p1",
      name: "In Development",
      category: "IN_PROGRESS",
      order: 1,
      isBacklog: false,
      color: "#0052CC",
      wipLimit: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s3",
      projectId: "p1",
      name: "Shipped",
      category: "DONE",
      order: 2,
      isBacklog: false,
      color: "#059669",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTransitions: WorkflowTransition[] = [
    {
      id: "t1",
      projectId: "p1",
      fromId: "s1",
      toId: "s2",
      createdAt: new Date().toISOString(),
    },
    {
      id: "t2",
      projectId: "p1",
      fromId: "s2",
      toId: "s3",
      createdAt: new Date().toISOString(),
    },
  ];

  it("renders status nodes, category column guides, and transition arrows", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkflowGraphView, {
        projectId: "p1",
        statuses: mockStatuses,
        transitions: mockTransitions,
        canManage: true,
        onToggleTransition: vi.fn(),
      })
    );

    // Status titles
    expect(html).toContain("Backlog");
    expect(html).toContain("In Development");
    expect(html).toContain("Shipped");

    // Category badges
    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");

    // Backlog badge and WIP limit
    expect(html).toContain("Backlog");
    expect(html).toContain("WIP: 4");

    // SVG elements: markers and paths
    expect(html).toContain("workflow-arrow");
    expect(html).toContain("workflow-grid");
    expect(html).toContain("<path");

    // Legend
    expect(html).toContain("Workflow Graph");
    expect(html).toContain("3 statuses, 2 transitions");
  });

  it("renders connect handles when canManage is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkflowGraphView, {
        projectId: "p1",
        statuses: mockStatuses,
        transitions: mockTransitions,
        canManage: true,
        onToggleTransition: vi.fn(),
      })
    );

    expect(html).toContain("Connect");
  });

  it("hides connect handles when canManage is false (read-only mode)", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkflowGraphView, {
        projectId: "p1",
        statuses: mockStatuses,
        transitions: mockTransitions,
        canManage: false,
        onToggleTransition: vi.fn(),
      })
    );

    expect(html).not.toContain("Connect");
  });
});

describe("WorkflowGraphView - General Start and Any-Node Separation", () => {
  const statuses: WorkflowStatus[] = [
    {
      id: "s-backlog",
      projectId: "p1",
      name: "Backlog",
      category: "TODO",
      order: 0,
      isBacklog: true,
      color: "#64748B",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-todo",
      projectId: "p1",
      name: "To Do",
      category: "TODO",
      order: 1,
      isBacklog: false,
      color: "#475569",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-in-prog",
      projectId: "p1",
      name: "In Progress",
      category: "IN_PROGRESS",
      order: 2,
      isBacklog: false,
      color: "#0052CC",
      wipLimit: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "s-done",
      projectId: "p1",
      name: "Done",
      category: "DONE",
      order: 3,
      isBacklog: false,
      color: "#059669",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("isTransitionFromAnyNode detects when a status has transitions from all other nodes", () => {
    // All other statuses (s-backlog, s-todo, s-in-prog) can transition to s-done
    const transitionKeys = new Set([
      "s-backlog:s-todo",
      "s-todo:s-in-prog",
      "s-backlog:s-done",
      "s-todo:s-done",
      "s-in-prog:s-done",
    ]);

    expect(isTransitionFromAnyNode("s-done", statuses, transitionKeys)).toBe(true);

    // s-in-prog only has transition from s-todo, not from s-backlog or s-done
    expect(isTransitionFromAnyNode("s-in-prog", statuses, transitionKeys)).toBe(false);

    // If one transition is missing (e.g. s-backlog:s-done), it's not from any node
    const missingOne = new Set(["s-todo:s-done", "s-in-prog:s-done"]);
    expect(isTransitionFromAnyNode("s-done", statuses, missingOne)).toBe(false);
  });

  it("isTransitionFromAnyNode returns false when workflow has fewer than 2 other nodes", () => {
    const twoStatuses = statuses.slice(0, 2); // only s-backlog and s-todo
    const keys = new Set(["s-backlog:s-todo"]);
    expect(isTransitionFromAnyNode("s-todo", twoStatuses, keys)).toBe(false);
  });

  it("computeAutoLayout separates any-node transition target with an extra gap", () => {
    // Both s-in-prog and s-cancelled in IN_PROGRESS, but s-cancelled can be reached from any node
    const cancelledStatus: WorkflowStatus = {
      id: "s-cancelled",
      projectId: "p1",
      name: "Cancelled",
      category: "IN_PROGRESS",
      order: 4,
      isBacklog: false,
      color: "#EF4444",
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const testStatuses = [...statuses, cancelledStatus];
    const keys = new Set([
      "s-backlog:s-cancelled",
      "s-todo:s-cancelled",
      "s-in-prog:s-cancelled",
      "s-done:s-cancelled",
    ]);

    const layout = computeAutoLayout(testStatuses, keys);

    // Standard in-prog should be at start y
    expect(layout["s-in-prog"].y).toBe(60);
    // Cancelled should be separated below in-prog with standard gap (120) + separation gap (40)
    expect(layout["s-cancelled"].y).toBe(60 + 120 + 40);
  });

  it("omits direct incoming edges to any-node target and renders General Start instead", () => {
    // s-done can be transitioned into from all other nodes (s-backlog, s-todo, s-in-prog)
    // s-done also has an outgoing transition to s-in-prog (reopen)
    const transitions: WorkflowTransition[] = [
      { id: "t1", projectId: "p1", fromId: "s-backlog", toId: "s-todo", createdAt: "" },
      { id: "t2", projectId: "p1", fromId: "s-todo", toId: "s-in-prog", createdAt: "" },
      { id: "t3", projectId: "p1", fromId: "s-backlog", toId: "s-done", createdAt: "" },
      { id: "t4", projectId: "p1", fromId: "s-todo", toId: "s-done", createdAt: "" },
      { id: "t5", projectId: "p1", fromId: "s-in-prog", toId: "s-done", createdAt: "" },
      { id: "t6", projectId: "p1", fromId: "s-done", toId: "s-in-prog", createdAt: "" },
    ];

    const html = renderToStaticMarkup(
      React.createElement(WorkflowGraphView, {
        projectId: "p1",
        statuses,
        transitions,
        canManage: true,
        onToggleTransition: vi.fn(),
      })
    );

    // 1. Direct incoming edges to s-done (t3, t4, t5) should NOT be rendered in the SVG
    // Note: t1, t2, and outgoing t6 SHOULD be rendered
    // Edge keys in SVG use `key="fromId:toId"`
    expect(html).not.toContain("s-backlog:s-done");
    expect(html).not.toContain("s-todo:s-done");
    expect(html).not.toContain("s-in-prog:s-done");

    // Outgoing transition from s-done (t6) should still be rendered
    expect(html).toContain("s-done:s-in-prog");

    // 2. General Start element should be rendered
    expect(html).toContain("general-start:s-done");
    expect(html).toContain("workflow-arrow-general-start");
    expect(html).toContain("ALL");

    // 3. Node card should render "General Start" badge and "ALL in" count
    expect(html).toContain("General Start");
    expect(html).toContain("ALL in");

    // 4. Footer legend should include General Start
    expect(html).toContain("General Start (from any status)");
  });
});
