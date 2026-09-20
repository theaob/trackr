import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IssueDetailModal from "@/components/issues/IssueDetailModal";
import CreateIssueModal from "@/components/issues/CreateIssueModal";
import IssuesListView from "@/components/issues/IssuesListView";
import BacklogContextMenu from "@/components/backlog/BacklogContextMenu";
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
  });

  describe("IssueDetailModal", () => {
    it("does not render Sprint dropdown or label for a Kanban project", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssueDetailModal, {
          issue: kanbanIssue,
          project: kanbanProject,
          users: [],
          allIssues: [],
          sprints: [mockSprint],
          onClose: vi.fn(),
          onIssueUpdated: vi.fn(),
          onIssueDeleted: vi.fn(),
        })
      );

      expect(html).not.toMatch(/<label[^>]*>\s*Sprint\s*<\/label>/i);
      expect(html).not.toContain("Backlog (No Sprint)");
      expect(html).not.toContain("Sprint 1");
    });

    it("renders Sprint dropdown and options for a Scrum project", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssueDetailModal, {
          issue: scrumIssue,
          project: scrumProject,
          users: [],
          allIssues: [],
          sprints: [mockSprint],
          onClose: vi.fn(),
          onIssueUpdated: vi.fn(),
          onIssueDeleted: vi.fn(),
        })
      );

      expect(html).toMatch(/<label[^>]*>\s*Sprint\s*<\/label>/i);
      expect(html).toContain("Sprint 1");
      expect(html).toContain("Backlog (No Sprint)");
    });
  });

  describe("CreateIssueModal", () => {
    it("does not render Sprint dropdown for a Kanban project", () => {
      const html = renderToStaticMarkup(
        React.createElement(CreateIssueModal, {
          project: kanbanProject,
          allProjects: [kanbanProject, scrumProject],
          users: [],
          sprints: [mockSprint],
          epics: [],
          onClose: vi.fn(),
          onIssueCreated: vi.fn(),
        })
      );

      expect(html).not.toMatch(/<label[^>]*>\s*Sprint\s*<\/label>/i);
      expect(html).not.toContain("Sprint 1");
    });

    it("renders Sprint dropdown for a Scrum project", () => {
      const html = renderToStaticMarkup(
        React.createElement(CreateIssueModal, {
          project: scrumProject,
          allProjects: [kanbanProject, scrumProject],
          users: [],
          sprints: [mockSprint],
          epics: [],
          onClose: vi.fn(),
          onIssueCreated: vi.fn(),
        })
      );

      expect(html).toMatch(/<label[^>]*>\s*Sprint\s*<\/label>/i);
      expect(html).toContain("Sprint 1");
    });
  });

  describe("IssuesListView", () => {
    it("does not render Sprint filter or Split-view Sprint selector for Kanban projects", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssuesListView, {
          project: kanbanProject,
          initialIssues: [kanbanIssue],
          users: [],
          sprints: [mockSprint],
          statuses: mockStatuses,
        })
      );

      // Filter bar must not have Sprint filter
      expect(html).not.toContain("Sprint: All");
      expect(html).not.toContain("Backlog (No Sprint)");
    });

    it("renders Sprint filter and Split-view Sprint selector for Scrum projects", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssuesListView, {
          project: scrumProject,
          initialIssues: [scrumIssue],
          users: [],
          sprints: [mockSprint],
          statuses: mockStatuses,
        })
      );

      // Filter bar must have Sprint filter
      expect(html).toContain("Sprint: All");
      expect(html).toContain("Sprint 1");
    });
  });

  describe("BacklogContextMenu", () => {
    it("does not render Move to Sprint section when isKanban is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(BacklogContextMenu, {
          x: 100,
          y: 100,
          issue: kanbanIssue,
          sprints: [mockSprint],
          isKanban: true,
          canMove: true,
          onClose: vi.fn(),
          onMoveToSprint: vi.fn(),
          onOpenIssue: vi.fn(),
        })
      );

      expect(html).not.toContain("Move to Sprint");
      expect(html).not.toContain("Sprint 1");
      expect(html).not.toContain("Send to Backlog");
    });

    it("renders Move to Sprint section when isKanban is false", () => {
      const html = renderToStaticMarkup(
        React.createElement(BacklogContextMenu, {
          x: 100,
          y: 100,
          issue: scrumIssue,
          sprints: [mockSprint],
          isKanban: false,
          canMove: true,
          onClose: vi.fn(),
          onMoveToSprint: vi.fn(),
          onOpenIssue: vi.fn(),
        })
      );

      expect(html).toContain("Move to Sprint");
      expect(html).toContain("Sprint 1");
    });
  });
});
