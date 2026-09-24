// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickCreateIssue from "../QuickCreateIssue";
import { ToastProvider } from "@/components/ui/Toast";
import type { CustomField, Project, Sprint, User } from "@/types";

const createIssue = vi.fn();
let customFields: Partial<CustomField>[] = [];
vi.mock("@/lib/actions/issues", () => ({ createIssue: (...args: unknown[]) => createIssue(...args) }));
vi.mock("@/lib/actions/versions", () => ({ getProjectVersions: vi.fn(async () => []) }));
vi.mock("@/lib/actions/customFields", () => ({
  getProjectCustomFields: vi.fn(async () => customFields),
  batchSetIssueCustomFieldValues: vi.fn(),
}));
vi.mock("@/lib/actions/workflows", () => ({
  getProjectWorkflow: vi.fn(async () => ({
    statuses: [
      { id: "b", name: "BACKLOG", isBacklog: true },
      { id: "t", name: "TODO", isBacklog: false },
    ],
  })),
}));
vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({ currentUser: { id: "u1", name: "Ada Lovelace", email: "ada@example.com", role: "ADMIN" } }),
}));
vi.mock("@/hooks/useProjectPermissions", () => ({ useProjectPermissions: () => ({ canCreateIssue: true }) }));
vi.mock("@/components/common/UserAvatar", () => ({ default: () => null }));

const scrum: Project = { id: "p1", key: "APOLLO", name: "Apollo", boardType: "SCRUM", description: null, leadId: null } as Project;
const kanban: Project = { ...scrum, id: "p2", key: "OPS", name: "Ops", boardType: "KANBAN" };
const sprint = { id: "s1", name: "Sprint 4", status: "ACTIVE", projectId: "p1" } as Sprint;
const users = [{ id: "u1", name: "Ada Lovelace", email: "ada@example.com" }] as User[];

function setup(project = scrum) {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <ToastProvider>
      <QuickCreateIssue open onOpenChange={onOpenChange} project={project} users={users} sprints={[sprint]} epics={[]} onCreated={onCreated} />
    </ToastProvider>
  );
  return { onOpenChange, onCreated, dialog: screen.getByRole("dialog", { name: "Create issue" }) };
}

beforeEach(() => {
  createIssue.mockReset();
  createIssue.mockImplementation(async (data: { title: string }) => ({
    success: true,
    issue: { id: "i1", key: "APOLLO-7", title: data.title, projectId: "p1" },
  }));
  customFields = [];
});

describe("quick create", () => {
  it("is one line: the title has focus, the description and rarer fields are folded away", async () => {
    const { dialog } = setup();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Title" })));
    expect(within(dialog).getByRole("button", { name: "Add description" })).toBeTruthy();
    expect(within(dialog).queryByLabelText("Story points")).toBeNull();
    const chips = within(dialog).getByRole("group", { name: "Issue properties" });
    expect(within(chips).getByRole("combobox", { name: "Type" }).textContent).toContain("Story");
    expect(within(chips).getByRole("combobox", { name: "Priority" }).textContent).toContain("Medium");
    expect(within(chips).getByRole("combobox", { name: "Assignee" }).textContent).toContain("Unassigned");
    // The active sprint is the default.
    await waitFor(() => expect(within(chips).getByRole("combobox", { name: "Sprint" }).textContent).toContain("Sprint 4"));
  });

  it("has no sprint chip in a Kanban project", () => {
    const { dialog } = setup(kanban);
    expect(within(dialog).queryByRole("combobox", { name: "Sprint" })).toBeNull();
  });

  it("tabs from the title straight into the description", async () => {
    const user = userEvent.setup();
    const { dialog } = setup();
    await user.click(within(dialog).getByRole("textbox", { name: "Title" }));
    await user.tab();
    expect(document.activeElement?.tagName).toBe("TEXTAREA");
    expect(within(dialog).queryByRole("button", { name: "Add description" })).toBeNull();
  });

  it("creates with ⌘↵ in the chosen sprint and closes", async () => {
    const user = userEvent.setup();
    const { dialog, onOpenChange, onCreated } = setup();
    await waitFor(() => expect(within(dialog).getByRole("combobox", { name: "Sprint" }).textContent).toContain("Sprint 4"));
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Fix the login page");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    expect(createIssue.mock.calls[0][0]).toMatchObject({
      projectId: "p1",
      title: "Fix the login page",
      type: "STORY",
      priority: "MEDIUM",
      sprintId: "s1",
      assigneeId: null,
      status: "TODO",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ key: "APOLLO-7" }));
    expect(await screen.findByText("Created APOLLO-7")).toBeTruthy();
  });

  it("stays open for the next one with Create another, keeping the properties", async () => {
    const user = userEvent.setup();
    const { dialog, onOpenChange } = setup();
    await user.click(within(dialog).getByRole("combobox", { name: "Priority" }));
    await user.click(screen.getByRole("option", { name: "High" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Create another" }));
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    await user.type(title, "First");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((title as HTMLInputElement).value).toBe(""));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(title);
    await user.type(title, "Second{Enter}");
    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(2));
    expect(createIssue.mock.calls[1][0]).toMatchObject({ title: "Second", priority: "HIGH" });
  });

  it("asks for a title, and opens the fields when a required one is empty", async () => {
    const user = userEvent.setup();
    customFields = [{ id: "cf1", name: "Customer", type: "TEXT", required: true, options: null, description: null }];
    const { dialog } = setup();
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Give the issue a title.");
    await waitFor(() => expect(within(dialog).getByRole("group", { name: "Customer" })).toBeTruthy());
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Needs a customer");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Customer is required.");
    expect(createIssue).not.toHaveBeenCalled();
  });
});
