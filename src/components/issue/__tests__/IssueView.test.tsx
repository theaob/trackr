// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/APOLLO/board",
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const updateIssue = vi.fn();
let fullIssue: any = null;
// Server actions reach for the database; the view only needs their answers.
vi.mock("@/lib/actions/issues", () => ({
  getIssueByKeyOrId: vi.fn(async () => fullIssue),
  getOlderIssueHistory: vi.fn(async () => []),
  getProjectEpics: vi.fn(async () => []),
  updateIssue: (...args: unknown[]) => updateIssue(...args),
  deleteIssue: vi.fn(async () => ({ success: true })),
  createIssue: vi.fn(),
  searchProjectIssuesForEpic: vi.fn(async () => []),
}));
vi.mock("@/lib/actions/comments", () => ({ addComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock("@/lib/actions/versions", () => ({ getProjectVersions: vi.fn(async () => []) }));
vi.mock("@/lib/actions/projects", () => ({ getProjectByKey: vi.fn(async () => null), getProjectUsers: vi.fn(async () => []) }));
vi.mock("@/lib/actions/sprints", () => ({ getProjectSprints: vi.fn(async () => []) }));
vi.mock("@/lib/actions/customFields", () => ({
  getProjectCustomFields: vi.fn(async () => []),
  getIssueCustomFieldValues: vi.fn(async () => []),
  setIssueCustomFieldValue: vi.fn(),
}));
vi.mock("@/lib/actions/workflows", () => ({
  getProjectWorkflow: vi.fn(async () => ({
    statuses: [
      { id: "s1", name: "TODO", category: "TODO", isBacklog: false, color: "#6b778c" },
      { id: "s2", name: "IN_PROGRESS", category: "IN_PROGRESS", isBacklog: false, color: "#0052cc" },
      { id: "s3", name: "DONE", category: "DONE", isBacklog: false, color: "#36b37e" },
    ],
    transitions: [
      { id: "t1", fromId: "s1", toId: "s2" },
      { id: "t2", fromId: "s2", toId: "s3" },
    ],
  })),
}));
vi.mock("@/lib/actions/watchers", () => ({
  getWatchState: vi.fn(async () => ({ watching: false, count: 0 })),
  toggleWatch: vi.fn(),
}));
vi.mock("@/lib/actions/attachments", () => ({ uploadAttachment: vi.fn(), deleteAttachment: vi.fn() }));
vi.mock("@/lib/actions/labels", () => ({ addIssueLabel: vi.fn(), removeIssueLabel: vi.fn(), getProjectLabels: vi.fn(async () => []) }));
vi.mock("@/lib/actions/components", () => ({
  addIssueComponent: vi.fn(),
  removeIssueComponent: vi.fn(),
  getProjectComponents: vi.fn(async () => []),
}));
vi.mock("@/lib/actions/issueLinks", () => ({
  createIssueLink: vi.fn(),
  deleteIssueLink: vi.fn(),
  searchLinkableIssues: vi.fn(async () => []),
}));
vi.mock("@/lib/actions/worklogs", () => ({ logWork: vi.fn(), deleteWorklog: vi.fn() }));

import IssueView from "../IssueView";
import { UserProvider } from "@/context/UserContext";
import { ToastProvider } from "@/components/ui/Toast";
import type { Issue, Project, User } from "@/types";

const me = { id: "u1", name: "Ada Lovelace", email: "ada@example.com", avatarUrl: null, role: "Developer" } as User;
const grace = { id: "u2", name: "Grace Hopper", avatarUrl: null, role: "Developer" } as User;
const project = { id: "p1", key: "APOLLO", name: "Apollo", boardType: "SCRUM", leadId: "u1", members: [] } as unknown as Project;

const baseIssue = (): Issue =>
  ({
    id: "i1",
    key: "APOLLO-3",
    title: "Fix the login page",
    description: "",
    type: "TASK",
    priority: "MEDIUM",
    status: "TODO",
    projectId: "p1",
    project,
    assigneeId: null,
    reporterId: "u1",
    reporter: me,
    sprintId: null,
    parentId: null,
    storyPoints: null,
    dueDate: null,
    startDate: null,
    originalEstimateSeconds: null,
    remainingEstimateSeconds: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    comments: [],
    activityLogs: [
      { id: "h1", action: "ASSIGNMENT_CHANGED", oldValue: "Unassigned", newValue: "u2", createdAt: "2026-09-21T10:00:00.000Z", user: me },
    ],
    _count: { comments: 0, activityLogs: 1 },
    children: [],
    linksAsSource: [],
    linksAsTarget: [],
    attachments: [],
    labels: [],
    components: [],
    worklogs: [],
  }) as unknown as Issue;

function renderView(props: Partial<React.ComponentProps<typeof IssueView>> = {}) {
  const issue = props.issue ?? baseIssue();
  fullIssue = issue;
  return render(
    <UserProvider sessionUser={me}>
      <ToastProvider>
        <IssueView issue={issue} variant="page" project={project} users={[me, grace]} sprints={[]} versions={[]} epics={[]} {...props} />
      </ToastProvider>
    </UserProvider>
  );
}

// Lets the workflow and other loads settle.
const settle = () => act(async () => {});

beforeEach(() => {
  push.mockReset();
  updateIssue.mockReset();
  updateIssue.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({
    success: true,
    issue: { ...fullIssue, ...data },
  }));
});

describe("IssueView", () => {
  it("shows the issue with its properties as pickers", async () => {
    renderView();
    await settle();
    expect(screen.getByRole("heading", { level: 1, name: "Fix the login page" })).toBeTruthy();
    const properties = screen.getByRole("complementary", { name: "Properties" });
    expect(within(properties).getByRole("combobox", { name: "Status" }).textContent).toContain("To Do");
    expect(within(properties).getByRole("combobox", { name: "Assignee" }).textContent).toContain("Unassigned");
    expect(within(properties).getByRole("combobox", { name: "Sprint" })).toBeTruthy();
  });

  it("collapses empty sections to their heading and action", async () => {
    renderView();
    await settle();
    expect(screen.getByRole("heading", { name: "Linked issues" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add files" })).toBeTruthy();
    expect(screen.queryByText(/No linked issues/i)).toBeNull();
    expect(screen.queryByText(/Drag and drop/i)).toBeNull();
  });

  it("opens the status picker with S and moves along the workflow", async () => {
    const user = userEvent.setup();
    renderView();
    await settle();
    await user.keyboard("s");
    const list = await screen.findByRole("listbox");
    // Only the moves the workflow allows from To Do.
    expect(
      within(list)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["To Do", "In Progress"]);
    await user.click(within(list).getByRole("option", { name: "In Progress" }));
    await waitFor(() => expect(updateIssue).toHaveBeenCalledWith("i1", expect.objectContaining({ status: "IN_PROGRESS" })));
  });

  it("assigns the issue to you with I", async () => {
    const user = userEvent.setup();
    renderView();
    await settle();
    await user.keyboard("i");
    await waitFor(() => expect(updateIssue).toHaveBeenCalledWith("i1", expect.objectContaining({ assigneeId: "u1" })));
    expect(screen.getByRole("combobox", { name: "Assignee" }).textContent).toContain("Ada Lovelace");
  });

  it("leaves g s to the page navigation, and letters typed in a comment alone", async () => {
    const user = userEvent.setup();
    renderView();
    await settle();
    await user.keyboard("gs");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Add a comment" }), "spa");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("edits the title in place", async () => {
    const user = userEvent.setup();
    renderView();
    await settle();
    await user.click(screen.getByRole("button", { name: "Edit title" }));
    const box = screen.getByRole("textbox", { name: "Title" });
    await user.clear(box);
    await user.type(box, "Fix the sign-in page{Enter}");
    await waitFor(() => expect(updateIssue).toHaveBeenCalledWith("i1", expect.objectContaining({ title: "Fix the sign-in page" })));
    expect(screen.getByRole("heading", { level: 1, name: "Fix the sign-in page" })).toBeTruthy();
  });

  it("shows history in words, with names for people", async () => {
    const user = userEvent.setup();
    renderView();
    await settle();
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText(/changed the assignee/).closest("li")?.textContent).toMatch(
      /Ada Lovelace changed the assignee from Unassigned to Grace Hopper/
    );
  });

  it("steps through the list it was opened from", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderView({ nav: { index: 2, total: 6, onPrev: vi.fn(), onNext, nextKey: "APOLLO-4" } });
    await settle();
    expect(screen.getByText("3 of 6")).toBeTruthy();
    await user.keyboard("{ArrowRight}");
    expect(onNext).toHaveBeenCalled();
  });

  it("opens a parent epic through the host", async () => {
    const onOpenIssue = vi.fn();
    const user = userEvent.setup();
    const issue = { ...baseIssue(), parentId: "e1", parent: { id: "e1", key: "APOLLO-1", title: "Accounts", type: "EPIC" } } as Issue;
    renderView({ issue, onOpenIssue, variant: "panel" });
    await settle();
    await user.click(screen.getByRole("button", { name: "Epic Accounts" }));
    expect(onOpenIssue).toHaveBeenCalledWith("APOLLO-1");
  });

  it("takes fresh threads from a page re-render instead of mistaking them for older ones", async () => {
    const first = baseIssue();
    const view = renderView({ issue: first });
    await settle();
    const refreshed = {
      ...first,
      comments: [{ id: "c1", content: "Ship it", authorId: "u1", author: me, createdAt: "2026-09-22T10:00:00.000Z" }],
      activityLogs: [
        { id: "h2", action: "COMMENTED", newValue: "Ship it", createdAt: "2026-09-22T10:00:00.000Z", user: me },
        ...(first.activityLogs ?? []),
      ],
      _count: { comments: 1, activityLogs: 2 },
    } as Issue;
    fullIssue = refreshed;
    view.rerender(
      <UserProvider sessionUser={me}>
        <ToastProvider>
          <IssueView issue={refreshed} variant="page" project={project} users={[me, grace]} sprints={[]} versions={[]} epics={[]} />
        </ToastProvider>
      </UserProvider>
    );
    await settle();
    expect(screen.getByText("Ship it")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Show older/ })).toBeNull();
  });
});
