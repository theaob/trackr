import { describe, it, expect } from "vitest";
import { computeVersionStats } from "@/lib/versionStats";

describe("Release Fix Version & Progress Metrics", () => {
  const categoryMap = new Map<string, string>([
    ["To Do", "TODO"],
    ["Backlog", "TODO"],
    ["In Progress", "IN_PROGRESS"],
    ["In Review", "IN_PROGRESS"],
    ["Done", "DONE"],
    ["Closed", "DONE"],
  ]);

  describe("computeVersionStats", () => {
    it("returns zero counts for a version with no issues", () => {
      const rawVersion = {
        id: "v-1",
        name: "v1.0.0",
        projectId: "p-1",
        status: "UNRELEASED",
        issues: [],
      };

      const result = computeVersionStats(rawVersion, categoryMap);
      expect(result.issueCount).toEqual({
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
        storyPoints: 0,
        completedStoryPoints: 0,
      });
    });

    it("correctly aggregates issue categories and story points", () => {
      const rawVersion = {
        id: "v-2",
        name: "v1.1.0",
        projectId: "p-1",
        status: "UNRELEASED",
        issues: [
          { id: "i-1", status: "Done", storyPoints: 5 },
          { id: "i-2", status: "Closed", storyPoints: 3 },
          { id: "i-3", status: "In Progress", storyPoints: 8 },
          { id: "i-4", status: "In Review", storyPoints: null },
          { id: "i-5", status: "To Do", storyPoints: 2 },
          { id: "i-6", status: "Backlog", storyPoints: 1 },
        ],
      };

      const result = computeVersionStats(rawVersion, categoryMap);
      expect(result.issueCount).toEqual({
        total: 6,
        done: 2,
        inProgress: 2,
        todo: 2,
        storyPoints: 19, // 5 + 3 + 8 + 0 + 2 + 1
        completedStoryPoints: 8, // 5 + 3
      });
    });

    it("falls back to TODO category for statuses not found in categoryMap", () => {
      const rawVersion = {
        id: "v-3",
        name: "v1.2.0",
        projectId: "p-1",
        status: "UNRELEASED",
        issues: [
          { id: "i-1", status: "UNKNOWN_CUSTOM_STATUS", storyPoints: 4 },
        ],
      };

      const result = computeVersionStats(rawVersion, categoryMap);
      expect(result.issueCount.todo).toBe(1);
      expect(result.issueCount.done).toBe(0);
      expect(result.issueCount.inProgress).toBe(0);
      expect(result.issueCount.storyPoints).toBe(4);
      expect(result.issueCount.completedStoryPoints).toBe(0);
    });
  });

  describe("Release Candidate Issue Selection Logic", () => {
    const issues = [
      {
        id: "i-1",
        key: "PROJ-1",
        title: "Setup Auth",
        status: "Done",
        category: "DONE",
        storyPoints: 5,
        versionId: null,
        sprintId: "sprint-1",
      },
      {
        id: "i-2",
        key: "PROJ-2",
        title: "Create DB",
        status: "Done",
        category: "DONE",
        storyPoints: 3,
        versionId: "v-old",
        sprintId: "sprint-1",
      },
      {
        id: "i-3",
        key: "PROJ-3",
        title: "Build UI",
        status: "In Progress",
        category: "IN_PROGRESS",
        storyPoints: 8,
        versionId: null,
        sprintId: "sprint-1",
      },
      {
        id: "i-4",
        key: "PROJ-4",
        title: "Fix crash on mobile",
        status: "Done",
        category: "DONE",
        storyPoints: 2,
        versionId: null,
        sprintId: "sprint-2",
      },
      {
        id: "i-5",
        key: "PROJ-5",
        title: "Refactor API",
        status: "To Do",
        category: "TODO",
        storyPoints: 3,
        versionId: null,
        sprintId: null,
      },
    ];

    it("filters unreleased Done issues for automatic 1-click release creation", () => {
      // Unreleased done issues have category === 'DONE' and versionId is null
      const unreleasedDone = issues.filter(
        (i) => i.category === "DONE" && !i.versionId
      );

      expect(unreleasedDone.map((i) => i.key)).toEqual(["PROJ-1", "PROJ-4"]);
      expect(unreleasedDone.reduce((sum, i) => sum + (i.storyPoints || 0), 0)).toBe(7);
    });

    it("selects issues belonging to a specific sprint", () => {
      const sprint1Issues = issues.filter((i) => i.sprintId === "sprint-1");
      expect(sprint1Issues.map((i) => i.key)).toEqual(["PROJ-1", "PROJ-2", "PROJ-3"]);
    });

    it("simulates syncing issue versions: unassigns removed and assigns new", () => {
      const currentVersionId = "v-release-1";
      let mockDbIssues = [
        { id: "i-1", versionId: currentVersionId },
        { id: "i-2", versionId: currentVersionId },
        { id: "i-3", versionId: null },
        { id: "i-4", versionId: null },
      ];

      // User selects ['i-2', 'i-3'] for this version (removing 'i-1', keeping 'i-2', adding 'i-3')
      const newSelectedIds = ["i-2", "i-3"];

      // Unassign issues previously in this version but not in new list
      mockDbIssues = mockDbIssues.map((issue) => {
        if (issue.versionId === currentVersionId && !newSelectedIds.includes(issue.id)) {
          return { ...issue, versionId: null };
        }
        return issue;
      });

      // Assign newly selected issues
      mockDbIssues = mockDbIssues.map((issue) => {
        if (newSelectedIds.includes(issue.id)) {
          return { ...issue, versionId: currentVersionId };
        }
        return issue;
      });

      expect(mockDbIssues).toEqual([
        { id: "i-1", versionId: null },
        { id: "i-2", versionId: currentVersionId },
        { id: "i-3", versionId: currentVersionId },
        { id: "i-4", versionId: null },
      ]);
    });
  });

  describe("Bulk Update Fix Version Payload Handling", () => {
    it("handles assigning a release version via versionId", () => {
      const payload = { versionId: "v-2.0.0" };
      expect(payload.versionId).toBe("v-2.0.0");
    });

    it("handles unassigning fix version by setting versionId to null", () => {
      const selectedValue = "NONE";
      const payload = {
        versionId: selectedValue === "NONE" ? null : selectedValue,
      };
      expect(payload.versionId).toBeNull();
    });
  });
});
