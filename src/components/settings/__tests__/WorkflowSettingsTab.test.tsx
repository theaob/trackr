// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowSettingsTab from "../WorkflowSettingsTab";
import { ToastProvider } from "@/components/ui/Toast";
import type { Project, WorkflowStatus, WorkflowTransition } from "@/types";

const actions = vi.hoisted(() => ({
  createWorkflowStatus: vi.fn(),
  updateWorkflowStatus: vi.fn(),
  deleteWorkflowStatus: vi.fn(),
  reorderWorkflowStatuses: vi.fn(),
  setWorkflowTransition: vi.fn(),
  setStatusTransitions: vi.fn(),
  allowEveryTransition: vi.fn(),
}));
vi.mock("@/lib/actions/workflows", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const project = { id: "p1", key: "APOLLO", name: "Apollo" } as Project;
const status = (id: string, name: string, order: number, category: WorkflowStatus["category"], extra: Partial<WorkflowStatus> = {}) =>
  ({ id, projectId: "p1", name, order, category, isBacklog: false, color: "#64748B", wipLimit: null, createdAt: "", updatedAt: "", ...extra }) as WorkflowStatus;
const statuses = [
  status("b", "BACKLOG", 0, "TODO", { isBacklog: true }),
  status("t", "TODO", 1, "TODO"),
  status("p", "IN_PROGRESS", 2, "IN_PROGRESS", { wipLimit: 4 }),
  status("d", "DONE", 3, "DONE"),
];
const move = (fromId: string, toId: string) => ({ id: `${fromId}${toId}`, projectId: "p1", fromId, toId, createdAt: "" }) as WorkflowTransition;
// Backlog → To Do → In Progress → Done, and back from In Progress to To Do.
const transitions = [move("b", "t"), move("t", "p"), move("p", "d"), move("p", "t")];

function setup(canManage = true) {
  return render(
    <ToastProvider>
      <WorkflowSettingsTab project={project} initialStatuses={statuses} initialTransitions={transitions} canManage={canManage} />
    </ToastProvider>
  );
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
  actions.updateWorkflowStatus.mockImplementation(async (id: string, patch: Partial<WorkflowStatus>) => ({
    success: true,
    status: { ...statuses.find((s) => s.id === id)!, ...patch },
  }));
  actions.createWorkflowStatus.mockImplementation(async (_: string, data: Partial<WorkflowStatus>) => ({
    success: true,
    status: status("n", data.name!, 4, data.category!, data),
  }));
  actions.setStatusTransitions.mockResolvedValue({ success: true });
  actions.setWorkflowTransition.mockResolvedValue({ success: true });
  actions.allowEveryTransition.mockResolvedValue({ success: true });
});

describe("workflow settings", () => {
  it("lists the statuses in board order with where each can go, and flags a dead end", () => {
    setup();
    const list = screen.getByRole("list", { name: "Statuses, in board order" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((r) => within(r).getByRole("button", { name: /^Edit / }).getAttribute("aria-label"))).toEqual([
      "Edit Backlog",
      "Edit To Do",
      "Edit In Progress",
      "Edit Done",
    ]);
    expect(rows[2].textContent).toContain("Column 2 · max 4");
    expect(rows[0].textContent).toContain("Backlog only");
    // Nothing leads back to the backlog, and Done is an end, which is fine.
    expect(rows[0].textContent).toContain("No status leads here");
    expect(rows[3].textContent).not.toContain("can't move on");
  });

  it("has a labelled box for every move in the table", async () => {
    setup();
    const box = screen.getByRole<HTMLInputElement>("checkbox", { name: "Move from In Progress to To Do" });
    expect(box.checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Move from Done to To Do" }).checked).toBe(false);
    await userEvent.click(box);
    expect(actions.setWorkflowTransition).toHaveBeenCalledWith("p1", "p", "t", false);
    expect(box.checked).toBe(false);
  });

  it("edits a status in the panel: an untouched name isn't renamed, and its moves save together", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Edit In Progress" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit In Progress" });
    expect(within(sheet).getByRole<HTMLInputElement>("textbox", { name: /Name/ }).value).toBe("In Progress");

    const moveTo = within(sheet).getByRole("group", { name: "Issues in In Progress can move to" });
    await userEvent.click(within(moveTo).getByRole("checkbox", { name: "To Do" }));
    await userEvent.clear(within(sheet).getByRole("spinbutton", { name: "Work-in-progress limit" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(actions.setStatusTransitions).toHaveBeenCalled());
    expect(actions.updateWorkflowStatus).toHaveBeenCalledWith("p", { wipLimit: null });
    expect(actions.setStatusTransitions).toHaveBeenCalledWith("p1", "p", { to: ["d"], from: ["t"] });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Move from In Progress to To Do" }).checked).toBe(false);
  });

  it("adds a status that every other status can reach and leave, unless told otherwise", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Add status" }));
    const sheet = await screen.findByRole("dialog", { name: "Add status" });
    const name = within(sheet).getByRole<HTMLInputElement>("textbox", { name: /Name/ });
    expect(document.activeElement).toBe(name);
    expect(name.required).toBe(true);
    await userEvent.click(within(sheet).getByRole("button", { name: "Add status" }));
    expect(actions.createWorkflowStatus).not.toHaveBeenCalled();

    await userEvent.type(name, "In review");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add status" }));
    await waitFor(() => expect(actions.setStatusTransitions).toHaveBeenCalled());
    expect(actions.createWorkflowStatus).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "In review", category: "IN_PROGRESS", isBacklog: false }));
    expect(actions.setStatusTransitions).toHaveBeenCalledWith("p1", "n", { to: ["b", "t", "p", "d"], from: ["b", "t", "p", "d"] });
    expect(await screen.findByRole("button", { name: "Edit In review" })).toBeTruthy();
  });

  it("shows the panel read-only to people who can't manage the project", async () => {
    setup(false);
    expect(screen.queryByRole("button", { name: "Add status" })).toBeNull();
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Move from To Do to In Progress" }).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "View Done" }));
    const sheet = await screen.findByRole("dialog", { name: "Done" });
    expect(within(sheet).getByRole<HTMLInputElement>("textbox", { name: /Name/ }).disabled).toBe(true);
    expect(within(sheet).queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
