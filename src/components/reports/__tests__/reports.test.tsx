// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VelocityChart from "../VelocityChart";
import BurndownChart from "../BurndownChart";
import DistributionChart from "../DistributionChart";
import { progressPct, timelineRange } from "@/components/roadmap/RoadmapTimeline";
import SaveBar from "@/components/settings/SaveBar";
import CreateVersionModal from "@/components/releases/CreateVersionModal";
import type { BurndownPoint } from "@/lib/burndown";

vi.mock("@/components/common/UserAvatar", () => ({ default: () => null }));
vi.mock("@/lib/actions/versions", () => ({
  createVersion: vi.fn(),
  updateVersion: vi.fn(),
  getReleaseEligibleIssues: vi.fn(async () => ({ issues: [], sprints: [] })),
}));

const day = (n: number) => new Date(2026, 8, 1 + n);

describe("reports", () => {
  it("velocity leads with the average and has a table view", async () => {
    const user = userEvent.setup();
    render(
      <VelocityChart
        sprints={[
          { id: "a", name: "Sprint 1", completedPoints: 10, committedPoints: 20 },
          { id: "b", name: "Sprint 2", completedPoints: 20, committedPoints: 20 },
        ]}
      />
    );
    expect(screen.getByText("Average velocity").nextSibling?.textContent).toContain("15");
    expect(screen.getByText("Commitment delivered").nextSibling?.textContent).toBe("75%");
    expect(screen.getByRole("img", { name: /Velocity chart/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Table" }).getAttribute("aria-pressed")).toBe("true");
    const table = screen.getByRole("table", { name: /Velocity by sprint/ });
    const rows = within(table).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(["SprintCommittedCompletedDelivered", "Sprint 12010" + "50%", "Sprint 22020100%"]);
  });

  it("burndown shows how far scope has moved since the start", () => {
    const points: BurndownPoint[] = [0, 1, 2].map((i) => ({
      date: day(i),
      ideal: 10 - i * 5,
      remaining: i < 2 ? 10 - i * 2 + (i === 1 ? 3 : 0) : null,
      scope: i === 0 ? 10 : 13,
      completed: i < 2 ? i * 2 : null,
      idealCompleted: i * 5,
      remainingIssues: null,
      completedIssues: null,
      totalIssues: 4,
    }));
    render(<BurndownChart points={points} totalPoints={10} />);
    expect(screen.getByText("Scope change").nextSibling?.textContent).toBe("+3pts");
    expect(screen.getByText("Remaining", { selector: "p" }).nextSibling?.textContent).toContain("11");
  });

  it("distribution lists every value with its share, largest first in the headline", () => {
    render(
      <DistributionChart
        data={{
          totalIssues: 4,
          totalPoints: 0,
          byStatus: [
            { name: "TODO", color: "#64748b", count: 3, points: 0 },
            { name: "DONE", color: "#008300", count: 1, points: 0 },
          ],
          byPriority: [],
          byType: [],
          byAssignee: [],
        }}
      />
    );
    expect(screen.getByText(/Largest share: To Do, 75%/)).toBeTruthy();
    const list = screen.getByRole("list", { name: "Issues by status" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(["To Do3 · 75%", "Done1 · 25%"]);
  });
});

describe("roadmap", () => {
  const epic = {
    id: "e",
    key: "A-1",
    title: "Epic",
    status: "TODO",
    statusColor: "#64748b",
    isDone: false,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    totalCount: 4,
    completedCount: 1,
    totalPoints: 0,
    completedPoints: 0,
  };

  it("measures progress by points when estimated, else by issues", () => {
    expect(progressPct(epic)).toBe(25);
    expect(progressPct({ ...epic, totalPoints: 10, completedPoints: 7 })).toBe(70);
    expect(progressPct({ ...epic, totalCount: 0, isDone: true })).toBe(100);
  });

  it("pads the timeline three days either side of the scheduled epics", () => {
    const { start, end } = timelineRange([epic, { ...epic, id: "u", startDate: null }]);
    expect(start.getDate()).toBe(29);
    expect(end.getDate()).toBe(3);
  });
});

describe("settings save bar", () => {
  it("only appears once something has changed", async () => {
    const onDiscard = vi.fn();
    const { rerender } = render(<SaveBar dirty={false} saving={false} form="f" onDiscard={onDiscard} />);
    expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull();
    rerender(<SaveBar dirty saving={false} form="f" onDiscard={onDiscard} />);
    const bar = screen.getByRole("region", { name: "Unsaved changes" });
    expect(within(bar).getByRole("button", { name: "Save changes" }).getAttribute("form")).toBe("f");
    await userEvent.setup().click(within(bar).getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalled();
  });
});

describe("releases", () => {
  it("asks for a release date, not a start date", async () => {
    render(<CreateVersionModal projectId="p-1" isOpen onClose={() => {}} onSaved={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "Create version" });
    expect(within(dialog).getByLabelText("Release date")).toBeTruthy();
    expect(within(dialog).queryByLabelText(/start date/i)).toBeNull();
  });
});
