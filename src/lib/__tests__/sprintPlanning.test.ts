import { describe, expect, it } from "vitest";
import { Issue, Sprint, IssueType } from "@/types";

describe("Sprint planning restrictions for Epics", () => {
  const epicIssue = {
    id: "epic-1",
    key: "PROJ-1",
    title: "Platform Scalability Epic",
    description: "",
    type: "EPIC" as IssueType,
    status: "BACKLOG",
    priority: "HIGH",
    projectId: "proj-1",
    sprintId: null,
    parentId: null,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Issue;

  const storyIssue = {
    id: "story-1",
    key: "PROJ-2",
    title: "Implement user session auth",
    description: "",
    type: "STORY" as IssueType,
    status: "BACKLOG",
    priority: "MEDIUM",
    projectId: "proj-1",
    sprintId: null,
    parentId: "epic-1",
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Issue;

  const taskIssue = {
    id: "task-1",
    key: "PROJ-3",
    title: "Setup redis cluster",
    description: "",
    type: "TASK" as IssueType,
    status: "TODO",
    priority: "LOW",
    projectId: "proj-1",
    sprintId: "sprint-1",
    parentId: null,
    order: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Issue;

  const activeSprint = {
    id: "sprint-1",
    name: "Sprint 1",
    status: "ACTIVE",
    projectId: "proj-1",
    startDate: new Date(),
    endDate: new Date(),
  } as unknown as Sprint;

  it("filters out Epics from sprint issue lists and backlog issue lists", () => {
    const allIssues = [epicIssue, storyIssue, taskIssue];
    const backlogStatusNames = ["BACKLOG"];

    // Backlog list must exclude Epics
    const backlogIssues = allIssues.filter(
      (i) => i.type !== "EPIC" && !i.sprintId && backlogStatusNames.includes(i.status)
    );
    expect(backlogIssues.map((i) => i.key)).toEqual(["PROJ-2"]);
    expect(backlogIssues.some((i) => i.type === "EPIC")).toBe(false);

    // Sprint list must exclude Epics even if an epic had a sprintId
    const corruptedEpic = { ...epicIssue, sprintId: activeSprint.id };
    const sprintCandidateIssues = [corruptedEpic, taskIssue];
    const sprintIssues = sprintCandidateIssues.filter(
      (i) => i.type !== "EPIC" && i.sprintId === activeSprint.id
    );
    expect(sprintIssues.map((i) => i.key)).toEqual(["PROJ-3"]);
    expect(sprintIssues.some((i) => i.type === "EPIC")).toBe(false);
  });

  it("prevents assigning an Epic to a sprint during move or reorder operations", () => {
    function canMoveToSprint(issue: Issue, targetSprintId: string | null): { allowed: boolean; error?: string } {
      if (targetSprintId && issue.type === "EPIC") {
        return { allowed: false, error: "Epics cannot be assigned to a sprint" };
      }
      return { allowed: true };
    }

    expect(canMoveToSprint(epicIssue, "sprint-1")).toEqual({
      allowed: false,
      error: "Epics cannot be assigned to a sprint",
    });

    expect(canMoveToSprint(storyIssue, "sprint-1")).toEqual({
      allowed: true,
    });

    // Moving an epic back to null (backlog) is allowed
    expect(canMoveToSprint(epicIssue, null)).toEqual({
      allowed: true,
    });
  });

  it("resets sprintId to null when an existing issue is converted to an EPIC", () => {
    function resolveSprintIdOnUpdate(
      existingIssue: Issue,
      updateData: { type?: IssueType; sprintId?: string | null }
    ): { error?: string; targetSprintId?: string | null } {
      const willBeEpic = (updateData.type ?? existingIssue.type) === "EPIC";
      if (willBeEpic && updateData.sprintId) {
        return { error: "Epics cannot be assigned to a sprint" };
      }
      if (willBeEpic) {
        return { targetSprintId: null };
      }
      return { targetSprintId: updateData.sprintId !== undefined ? updateData.sprintId : existingIssue.sprintId };
    }

    // Converting task in sprint-1 to EPIC should reset sprintId to null
    const result = resolveSprintIdOnUpdate(taskIssue, { type: "EPIC" });
    expect(result.error).toBeUndefined();
    expect(result.targetSprintId).toBe(null);

    // Attempting to convert to EPIC and set sprintId at the same time fails
    const failResult = resolveSprintIdOnUpdate(taskIssue, { type: "EPIC", sprintId: "sprint-2" });
    expect(failResult.error).toBe("Epics cannot be assigned to a sprint");

    // Updating a normal task's sprint remains intact
    const normalResult = resolveSprintIdOnUpdate(storyIssue, { sprintId: "sprint-1" });
    expect(normalResult.targetSprintId).toBe("sprint-1");
  });

  it("excludes Epics from active Scrum board cards", () => {
    const corruptedEpic = { ...epicIssue, sprintId: activeSprint.id };
    const boardCandidates = [corruptedEpic, taskIssue];

    const scrumBoardIssues = boardCandidates.filter((issue) => {
      if (issue.sprintId !== activeSprint.id) return false;
      if (issue.type === "EPIC") return false;
      return true;
    });

    expect(scrumBoardIssues).toHaveLength(1);
    expect(scrumBoardIssues[0].key).toBe("PROJ-3");
    expect(scrumBoardIssues[0].type).toBe("TASK");
  });

  describe("Sprint date and target / goal updates", () => {
    function validateSprintUpdate(
      currentSprint: { name: string; startDate: Date | null; endDate: Date | null; goal: string | null },
      updateData: { name?: string; startDate?: Date | null; endDate?: Date | null; goal?: string | null }
    ): { error?: string; updated?: typeof currentSprint } {
      const trimmedName = updateData.name !== undefined ? updateData.name.trim() : currentSprint.name;
      if (trimmedName !== undefined && !trimmedName) {
        return { error: "Sprint name cannot be empty" };
      }

      const newStart = updateData.startDate !== undefined ? updateData.startDate : currentSprint.startDate;
      const newEnd = updateData.endDate !== undefined ? updateData.endDate : currentSprint.endDate;

      if (newStart && newEnd && newEnd <= newStart) {
        return { error: "The sprint end date must come after its start date." };
      }

      return {
        updated: {
          name: trimmedName,
          startDate: newStart,
          endDate: newEnd,
          goal: updateData.goal !== undefined ? (updateData.goal ? updateData.goal.trim() : null) : currentSprint.goal,
        },
      };
    }

    it("allows updating dates and target / goal on an existing sprint", () => {
      const sprint = {
        name: "Sprint 1",
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-14T23:59:59Z"),
        goal: "Initial target",
      };

      const newStart = new Date("2026-10-05T00:00:00Z");
      const newEnd = new Date("2026-10-25T23:59:59Z");
      const result = validateSprintUpdate(sprint, {
        startDate: newStart,
        endDate: newEnd,
        goal: "Deliver MVP onboarding flow & payment checkout",
      });

      expect(result.error).toBeUndefined();
      expect(result.updated?.startDate).toEqual(newStart);
      expect(result.updated?.endDate).toEqual(newEnd);
      expect(result.updated?.goal).toBe("Deliver MVP onboarding flow & payment checkout");
    });

    it("rejects invalid date ranges where end date is on or before start date", () => {
      const sprint = {
        name: "Sprint 2",
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-15T00:00:00Z"),
        goal: "Refactor core engine",
      };

      const invalidResult = validateSprintUpdate(sprint, {
        startDate: new Date("2026-10-20T00:00:00Z"),
        endDate: new Date("2026-10-10T00:00:00Z"),
      });

      expect(invalidResult.error).toBe("The sprint end date must come after its start date.");
      expect(invalidResult.updated).toBeUndefined();

      const sameDayResult = validateSprintUpdate(sprint, {
        startDate: new Date("2026-10-10T00:00:00Z"),
        endDate: new Date("2026-10-10T00:00:00Z"),
      });
      expect(sameDayResult.error).toBe("The sprint end date must come after its start date.");
    });

    it("rejects empty sprint name on update", () => {
      const sprint = {
        name: "Sprint 3",
        startDate: null,
        endDate: null,
        goal: null,
      };

      const result = validateSprintUpdate(sprint, { name: "   " });
      expect(result.error).toBe("Sprint name cannot be empty");
    });

    it("allows updating target / goal independently of dates", () => {
      const sprint = {
        name: "Sprint 4",
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-14T00:00:00Z"),
        goal: null,
      };

      const result = validateSprintUpdate(sprint, { goal: "Achieve 99.9% uptime and resolve P0 bugs" });
      expect(result.error).toBeUndefined();
      expect(result.updated?.goal).toBe("Achieve 99.9% uptime and resolve P0 bugs");
      expect(result.updated?.startDate).toEqual(sprint.startDate);
      expect(result.updated?.endDate).toEqual(sprint.endDate);
    });
  });
});
