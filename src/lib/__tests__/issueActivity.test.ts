import { describe, expect, it } from "vitest";
import type { Issue } from "@/types";
import { activityPage, describeActivity, issueShortcutFor } from "@/lib/issueActivity";

const at = (minute: number) => new Date(Date.UTC(2026, 8, 24, 10, minute)).toISOString();
const comment = (id: string, minute: number) => ({ id, content: id, createdAt: at(minute), author: { name: "Ada" } });
const log = (id: string, minute: number, action = "STATUS_CHANGED") => ({
  id,
  action,
  createdAt: at(minute),
  oldValue: "TODO",
  newValue: "DONE",
});

function issueWith(comments: any[], logs: any[], counts?: { comments: number; activityLogs: number }): Issue {
  return { id: "i1", key: "A-1", comments, activityLogs: logs, _count: counts } as unknown as Issue;
}

describe("activityPage", () => {
  it("merges comments and history newest first", () => {
    const page = activityPage(issueWith([comment("c1", 30), comment("c2", 10)], [log("h1", 20), log("h2", 5)]), "all");
    expect(page.entries.map((e) => e.id)).toEqual(["c1", "h1", "c2", "h2"]);
    expect(page.remaining).toBe(0);
    expect(page.loadKinds).toEqual([]);
  });

  it("leaves out the history entry a comment already shows", () => {
    const page = activityPage(issueWith([comment("c1", 30)], [log("h1", 30, "COMMENTED"), log("h2", 20)]), "all");
    expect(page.entries.map((e) => e.id)).toEqual(["c1", "h2"]);
  });

  it("holds back entries below a list's unloaded gap until its next page arrives", () => {
    // History has more beyond h2 (minute 20); the comment at minute 5 might be
    // newer than history that hasn't loaded, so it waits.
    const issue = issueWith([comment("c1", 30), comment("c2", 5)], [log("h1", 25), log("h2", 20)], { comments: 2, activityLogs: 60 });
    const page = activityPage(issue, "all");
    expect(page.entries.map((e) => e.id)).toEqual(["c1", "h1", "h2"]);
    expect(page.remaining).toBe(58 + 1);
    expect(page.loadKinds).toEqual(["activity"]);
  });

  it("keeps an optimistic comment whatever its time", () => {
    const issue = issueWith([{ ...comment("temp-1", 0) }], [log("h1", 25)], { comments: 1, activityLogs: 60 });
    expect(activityPage(issue, "all").entries.map((e) => e.id)).toContain("temp-1");
  });

  it("narrows to one list per tab, each paged on its own", () => {
    const issue = issueWith([comment("c1", 30)], [log("h1", 25)], { comments: 51, activityLogs: 1 });
    expect(activityPage(issue, "comments")).toMatchObject({ remaining: 50, loadKinds: ["comments"] });
    expect(activityPage(issue, "history")).toMatchObject({ remaining: 0, loadKinds: [] });
    expect(activityPage(issue, "history").entries.map((e) => e.id)).toEqual(["h1"]);
  });
});

describe("describeActivity", () => {
  it("names status and priority changes in words", () => {
    expect(describeActivity({ action: "STATUS_CHANGED", oldValue: "IN_PROGRESS", newValue: "DONE" })).toEqual({
      verb: "changed the status",
      from: "In Progress",
      to: "Done",
    });
    expect(describeActivity({ action: "PRIORITY_CHANGED", oldValue: "LOW", newValue: "HIGHEST" })).toMatchObject({
      from: "Low",
      to: "Highest",
    });
  });

  it("turns assignee ids back into names", () => {
    const names: Record<string, string> = { u1: "Ada", u2: "Grace" };
    expect(describeActivity({ action: "ASSIGNMENT_CHANGED", oldValue: "u1", newValue: "u2" }, (id) => names[id])).toMatchObject({
      from: "Ada",
      to: "Grace",
    });
    expect(describeActivity({ action: "ASSIGNMENT_CHANGED", oldValue: "u1", newValue: "Unassigned" }, (id) => names[id]).to).toBe(
      "Unassigned"
    );
  });

  it("falls back to the raw action for ones it doesn't know", () => {
    expect(describeActivity({ action: "SOMETHING_NEW", field: "x", newValue: "y" })).toMatchObject({ verb: "something new (x)", to: "y" });
  });
});

describe("issueShortcutFor", () => {
  const key = (k: string, extra = {}) => ({ key: k, ...extra });
  const idle = { typing: false, afterG: false };

  it("maps A, S, P and I", () => {
    expect(issueShortcutFor(key("a"), idle)).toBe("assignee");
    expect(issueShortcutFor(key("s"), idle)).toBe("status");
    expect(issueShortcutFor(key("p"), idle)).toBe("priority");
    expect(issueShortcutFor(key("i"), idle)).toBe("assign-to-me");
    expect(issueShortcutFor(key("x"), idle)).toBeNull();
  });

  it("stays out of the way while typing, after g, with modifiers or when handled", () => {
    expect(issueShortcutFor(key("s"), { typing: true, afterG: false })).toBeNull();
    expect(issueShortcutFor(key("s"), { typing: false, afterG: true })).toBeNull();
    expect(issueShortcutFor(key("s", { metaKey: true }), idle)).toBeNull();
    expect(issueShortcutFor(key("S", { shiftKey: true }), idle)).toBeNull();
    expect(issueShortcutFor(key("s", { defaultPrevented: true }), idle)).toBeNull();
  });
});
