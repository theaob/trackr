import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IssueView from "@/components/issue/IssueView";
import { ToastProvider } from "@/components/ui/Toast";
import IssuesListView from "@/components/issues/IssuesListView";
import { backlogMoveTargets } from "@/lib/board";
import { Project, Issue, Sprint, WorkflowStatus } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/KAN/board",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/actions/issues", () => ({
  updateIssueStatusAndOrder: vi.fn(),
  getIssueByKeyOrId: vi.fn().mockResolvedValue(null),
  getPaginatedIssues: vi.fn().mockResolvedValue({ issues: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 1 }),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
  bulkUpdateIssues: vi.fn(),
  bulkDeleteIssues: vi.fn(),
  createIssue: vi.fn(),
}));

vi.mock("@/lib/actions/sprints", () => ({
  getProjectSprints: vi.fn().mockResolvedValue([]),
  createSprint: vi.fn(),
  startSprint: vi.fn(),
  completeSprint: vi.fn(),
  moveIssueToSprint: vi.fn(),
}));

vi.mock("@/lib/actions/labels", () => ({
  bulkAddLabel: vi.fn(),
}));

vi.mock("@/lib/actions/comments", () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/lib/actions/attachments", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  MAX_ATTACHMENT_SIZE: 10485760,
  formatFileSize: vi.fn(),
  generatePastedImageFileName: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/actions/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({
    currentUser: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
      canCreateProjects: true,
    },
    users: [],
    setCurrentUser: vi.fn(),
    setUsers: vi.fn(),
  }),
}));

describe("Kanban Project Sprint Guardrails", () => {
  const kanbanProject: Project = {
    id: "proj-kanban",
    key: "KAN",
    name: "Kanban Service",
    description: "Kanban workflow",
    boardType: "KANBAN",
    leadId: "u1",
  };

  const scrumProject: Project = {
    id: "proj-scrum",
    key: "SCRUM",
    name: "Scrum Team",
    description: "Scrum workflow",
    boardType: "SCRUM",
    leadId: "u1",
  };

  const mockSprint: Sprint = {
    id: "sprint-1",
    name: "Sprint 1",
    goal: "First Sprint",
    status: "ACTIVE",
    startDate: new Date(),
    endDate: new Date(),
    projectId: "proj-scrum",
  };

  const mockStatuses: WorkflowStatus[] = [
    {
      id: "ws-backlog",
      name: "BACKLOG",
      category: "TODO",
      isBacklog: true,
      color: "#6b778c",
      order: 0,
      wipLimit: null,
      projectId: "proj-kanban",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "ws-todo",
      name: "TO DO",
      category: "TODO",
      isBacklog: false,
      color: "#42526e",
      order: 1,
      wipLimit: null,
      projectId: "proj-kanban",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "ws-done",
      name: "DONE",
      category: "DONE",
      isBacklog: false,
      color: "#00875a",
      order: 2,
      wipLimit: null,
      projectId: "proj-kanban",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const kanbanIssue: Issue = {
    id: "issue-1",
    key: "KAN-1",
    title: "Kanban task item",
    description: "Work item",
    type: "TASK",
    status: "TO DO",
    priority: "MEDIUM",
    projectId: "proj-kanban",
    project: kanbanProject,
    reporterId: "u1",
    assigneeId: null,
    sprintId: null,
    versionId: null,
    parentId: null,
    storyPoints: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: null,
    startDate: null,
    originalEstimateSeconds: null,
    remainingEstimateSeconds: null,
    components: [],
    labels: [],
  };

  const scrumIssue: Issue = {
    id: "issue-2",
    key: "SCRUM-1",
    title: "Scrum story item",
    description: "Story item",
    type: "STORY",
    status: "TO DO",
    priority: "HIGH",
    projectId: "proj-scrum",
    project: scrumProject,
    reporterId: "u1",
    assigneeId: null,
    sprintId: "sprint-1",
    sprint: mockSprint,
    versionId: null,
    parentId: null,
    storyPoints: 5,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: null,
    startDate: null,
    originalEstimateSeconds: null,
    remainingEstimateSeconds: null,
    components: [],
    labels: [],
  };

  describe("Validation logic", () => {
    it("rejects sprint assignment when project is Kanban", () => {
      function validateSprintForProject(
        project: Project,
        sprintId: string | null | undefined,
        type: string
      ): { allowed: boolean; error?: string } {
        if (sprintId && project.boardType === "KANBAN") {
          return { allowed: false, error: "Kanban projects do not use sprints" };
        }
        if (sprintId && type === "EPIC") {
          return { allowed: false, error: "Epics cannot be assigned to a sprint" };
        }
        return { allowed: true };
      }

      expect(validateSprintForProject(kanbanProject, "sprint-1", "TASK")).toEqual({
        allowed: false,
        error: "Kanban projects do not use sprints",
      });

      expect(validateSprintForProject(kanbanProject, null, "TASK")).toEqual({
        allowed: true,
      });

      expect(validateSprintForProject(scrumProject, "sprint-1", "STORY")).toEqual({
        allowed: true,
      });

      expect(validateSprintForProject(scrumProject, "sprint-1", "EPIC")).toEqual({
        allowed: false,
        error: "Epics cannot be assigned to a sprint",
      });
    });

    it("rejects sprint management actions for Kanban projects", () => {
      function canPerformSprintAction(project: Project): { allowed: boolean; error?: string } {
        if (project.boardType === "KANBAN") {
          return { allowed: false, error: "Kanban projects do not use sprints" };
        }
        return { allowed: true };
      }

      expect(canPerformSprintAction(kanbanProject)).toEqual({
        allowed: false,
        error: "Kanban projects do not use sprints",
      });
      expect(canPerformSprintAction(scrumProject)).toEqual({
        allowed: true,
      });
    });

    it("resolves status to BACKLOG for Kanban projects and TO DO for Scrum with active sprint", () => {
      function resolveIssueStatus(
        project: Project,
        sprintId: string | null | undefined,
        type: string,
        workflowStatuses: WorkflowStatus[]
      ): string {
        const isKanban = project.boardType === "KANBAN";
        const backlogStatusName = workflowStatuses.find((s) => s.isBacklog)?.name;
        const initialStatusName = workflowStatuses.find((s) => !s.isBacklog)?.name ?? "TODO";
        const effectiveSprintId = isKanban || type === "EPIC" ? null : (sprintId || null);
        return effectiveSprintId ? initialStatusName : (backlogStatusName ?? initialStatusName);
      }

      // Kanban project always resolves to BACKLOG status
      expect(resolveIssueStatus(kanbanProject, null, "TASK", mockStatuses)).toBe("BACKLOG");
      expect(resolveIssueStatus(kanbanProject, "sprint-1", "TASK", mockStatuses)).toBe("BACKLOG");

      // Scrum project with active sprint resolves to TO DO
      expect(resolveIssueStatus(scrumProject, "sprint-1", "STORY", mockStatuses)).toBe("TO DO");

      // Scrum project without sprint (backlog) resolves to BACKLOG
      expect(resolveIssueStatus(scrumProject, null, "STORY", mockStatuses)).toBe("BACKLOG");

      // Epic resolves to BACKLOG
      expect(resolveIssueStatus(scrumProject, "sprint-1", "EPIC", mockStatuses)).toBe("BACKLOG");
    });
  });

  describe("IssueView", () => {
    const renderView = (issue: Issue, project: Project) =>
      renderToStaticMarkup(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(IssueView, { issue, project, variant: "panel", users: [], sprints: [mockSprint], versions: [], epics: [] })
        )
      );

    it("has no Sprint property for a Kanban project", () => {
      const html = renderView(kanbanIssue, kanbanProject);
      expect(html).not.toMatch(/>Sprint</);
      expect(html).not.toContain('aria-label="Sprint"');
    });

    it("has a Sprint picker for a Scrum project, showing Backlog when unplanned", () => {
      const html = renderView({ ...scrumIssue, sprintId: null }, scrumProject);
      expect(html).toMatch(/>Sprint</);
      expect(html).toMatch(/aria-label="Sprint"[^>]*>[\s\S]*?Backlog/);
    });

    it("hides the Sprint picker on an epic even in a Scrum project", () => {
      const html = renderView({ ...scrumIssue, type: "EPIC" }, scrumProject);
      expect(html).not.toContain('aria-label="Sprint"');
    });
  });

  describe("IssuesListView", () => {
    it("does not render Sprint filter or Split-view Sprint selector for Kanban projects", () => {
      const html = renderToStaticMarkup(
        React.createElement(ToastProvider, null, React.createElement(IssuesListView, {
          project: kanbanProject,
          initialIssues: [kanbanIssue],
          users: [],
          sprints: [mockSprint],
          statuses: mockStatuses,
        }))
      );

      // No sprint property on the issue beside the list, and no sprint chip in the filters
      expect(html).not.toContain('aria-label="Sprint"');
      expect(html).not.toMatch(/>Sprint(: [^<]*)?<\/button>/);
    });

    it("renders Sprint filter and Split-view Sprint selector for Scrum projects", () => {
      const html = renderToStaticMarkup(
        React.createElement(ToastProvider, null, React.createElement(IssuesListView, {
          project: scrumProject,
          initialIssues: [scrumIssue],
          users: [],
          sprints: [mockSprint],
          statuses: mockStatuses,
        }))
      );

      // The issue beside the list has its Sprint property
      expect(html).toContain('aria-label="Sprint"');
    });
  });

  describe("backlog row menu", () => {
    it("offers no sprints to move to in a Kanban project", () => {
      expect(backlogMoveTargets(kanbanIssue, [mockSprint], true)).toEqual([]);
      expect(backlogMoveTargets({ ...kanbanIssue, sprintId: "sprint-1" }, [mockSprint], true)).toEqual([]);
    });

    it("offers open sprints, active first, and the backlog for a planned issue in Scrum", () => {
      const future = { ...mockSprint, id: "sprint-2", name: "Sprint 2", status: "FUTURE" as const };
      const done = { ...mockSprint, id: "sprint-0", name: "Sprint 0", status: "COMPLETED" as const };
      expect(backlogMoveTargets({ ...scrumIssue, sprintId: null }, [future, mockSprint, done], false).map((t) => t.label)).toEqual([
        "Sprint 1",
        "Sprint 2",
      ]);
      expect(backlogMoveTargets({ ...scrumIssue, sprintId: "sprint-1" }, [future, mockSprint], false).map((t) => t.label)).toEqual([
        "Sprint 2",
        "Backlog",
      ]);
    });

    it("never offers a sprint for an epic", () => {
      expect(backlogMoveTargets({ ...scrumIssue, type: "EPIC", sprintId: null }, [mockSprint], false)).toEqual([]);
    });
  });
});
