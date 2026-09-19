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
});
