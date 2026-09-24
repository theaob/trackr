import { describe, expect, it } from "vitest";
import {
  dueBucket,
  groupDueSoon,
  isProjectMember,
  parseRecentIssues,
  projectInitials,
  pushRecentIssue,
  recentIssuesStorageKey,
  shellLocation,
  type RecentIssue,
} from "@/lib/shell";
import { inboxDayLabel, notificationTarget } from "@/lib/notificationLinks";

describe("shellLocation", () => {
  it("names project pages the way the rail does", () => {
    expect(shellLocation("/projects/apollo/board")).toEqual({ section: "project", projectKey: "APOLLO", pageId: "board", title: "Board" });
    expect(shellLocation("/projects/APOLLO/settings?tab=workflow").title).toBe("Settings");
    expect(shellLocation("/projects/APOLLO/issues").title).toBe("Issues");
  });

  it("knows the pages outside a project", () => {
    expect(shellLocation("/home")).toMatchObject({ section: "home", title: "Home" });
    expect(shellLocation("/inbox")).toMatchObject({ section: "inbox", title: "Inbox" });
    expect(shellLocation("/projects")).toMatchObject({ section: "projects", title: "Projects" });
    expect(shellLocation("/settings")).toMatchObject({ section: "system-settings" });
    expect(shellLocation(null).section).toBe("other");
  });

  it("falls back to the project key for an unknown project page", () => {
    expect(shellLocation("/projects/apollo/unknown")).toEqual({ section: "project", projectKey: "APOLLO", title: "APOLLO" });
  });
});

describe("projectInitials", () => {
  it("takes the first two letters of the key", () => {
    expect(projectInitials("APOLLO")).toBe("AP");
    expect(projectInitials("x")).toBe("X");
    expect(projectInitials("--")).toBe("?");
  });
});

describe("recently viewed issues", () => {
  const entry = (key: string, viewedAt = 1): RecentIssue => ({ key, title: `Title ${key}`, projectKey: key.split("-")[0], viewedAt });

  it("moves a reopened issue to the front without duplicating it", () => {
    const list = [entry("A-1"), entry("A-2"), entry("A-3")];
    expect(pushRecentIssue(list, entry("A-3", 9)).map((i) => i.key)).toEqual(["A-3", "A-1", "A-2"]);
  });

  it("keeps at most the limit", () => {
    let list: RecentIssue[] = [];
    for (let n = 1; n <= 12; n++) list = pushRecentIssue(list, entry(`A-${n}`));
    expect(list).toHaveLength(8);
    expect(list[0].key).toBe("A-12");
  });

  it("drops malformed stored entries and survives bad JSON", () => {
    const stored = JSON.stringify([entry("A-1"), { key: "<script>", title: "x", projectKey: "A", viewedAt: 1 }, { key: "A-2" }, null, 5]);
    expect(parseRecentIssues(stored).map((i) => i.key)).toEqual(["A-1"]);
    expect(parseRecentIssues("{not json")).toEqual([]);
    expect(parseRecentIssues(JSON.stringify({ key: "A-1" }))).toEqual([]);
    expect(parseRecentIssues(null)).toEqual([]);
  });

  it("stores each account's list separately", () => {
    expect(recentIssuesStorageKey("u1")).not.toBe(recentIssuesStorageKey("u2"));
  });
});

describe("due dates on Home", () => {
  // Wednesday 24 September 2026, mid-morning where the viewer is.
  const now = new Date(2026, 8, 24, 10, 0, 0);

  it("buckets calendar due dates by the viewer's day", () => {
    expect(dueBucket("2026-09-23T00:00:00.000Z", now)).toBe("overdue");
    expect(dueBucket("2026-09-24T00:00:00.000Z", now)).toBe("today");
    expect(dueBucket("2026-09-25T00:00:00.000Z", now)).toBe("week");
    expect(dueBucket("2026-10-01T00:00:00.000Z", now)).toBe("week");
    expect(dueBucket("2026-10-02T00:00:00.000Z", now)).toBe("later");
  });

  it("groups issues earliest first and leaves out later ones and undated ones", () => {
    const issues = [
      { key: "A-4", dueDate: "2026-09-30T00:00:00.000Z" },
      { key: "A-1", dueDate: "2026-09-20T00:00:00.000Z" },
      { key: "A-5", dueDate: "2026-12-01T00:00:00.000Z" },
      { key: "A-2", dueDate: "2026-09-24T00:00:00.000Z" },
      { key: "A-3", dueDate: "2026-09-26T00:00:00.000Z" },
      { key: "A-6", dueDate: null },
    ];
    expect(groupDueSoon(issues, now).map((g) => [g.bucket, g.issues.map((i) => i.key)])).toEqual([
      ["overdue", ["A-1"]],
      ["today", ["A-2"]],
      ["week", ["A-3", "A-4"]],
    ]);
  });
});

describe("notificationTarget", () => {
  it("adds the issue from the title to a link without one", () => {
    expect(notificationTarget({ title: "APOLLO-3 was assigned to you", message: "", link: "/projects/APOLLO/board" })).toEqual({
      href: "/projects/APOLLO/board?selectedIssue=APOLLO-3",
      issueKey: "APOLLO-3",
    });
  });

  it("keeps a link that already names the issue, and appends to an existing query", () => {
    expect(notificationTarget({ title: "APOLLO-3", message: "", link: "/projects/APOLLO/board?selectedIssue=APOLLO-3" }).href).toBe(
      "/projects/APOLLO/board?selectedIssue=APOLLO-3"
    );
    expect(notificationTarget({ title: "APOLLO-3", message: "", link: "/projects/APOLLO/issues?view=all" }).href).toBe(
      "/projects/APOLLO/issues?view=all&selectedIssue=APOLLO-3"
    );
  });

  it("builds a link from the key in the message when there is none", () => {
    expect(notificationTarget({ title: "You were mentioned", message: "in ORION-12: hello", link: null })).toEqual({
      href: "/projects/ORION/board?selectedIssue=ORION-12",
      issueKey: "ORION-12",
    });
  });

  it("never follows a link off the site", () => {
    expect(notificationTarget({ title: "Hi", message: "", link: "https://evil.example/x" }).href).toBeNull();
    expect(notificationTarget({ title: "Hi", message: "", link: "//evil.example/x" }).href).toBeNull();
  });
});

describe("inboxDayLabel", () => {
  const now = new Date(2026, 8, 24, 10, 0, 0);
  it("says Today and Yesterday, then the date", () => {
    expect(inboxDayLabel(new Date(2026, 8, 24, 1), now)).toBe("Today");
    expect(inboxDayLabel(new Date(2026, 8, 23, 23), now)).toBe("Yesterday");
    expect(inboxDayLabel(new Date(2026, 8, 10), now)).not.toMatch(/Today|Yesterday/);
  });
});

describe("isProjectMember", () => {
  it("counts the lead and members, not readers of a public project", () => {
    expect(isProjectMember("u1", { leadId: "u1", members: [] })).toBe(true);
    expect(isProjectMember("u1", { leadId: "x", members: [{ userId: "u1" }] })).toBe(true);
    expect(isProjectMember("u1", { leadId: "x", members: [] })).toBe(false);
    expect(isProjectMember(null, { leadId: null, members: [] })).toBe(false);
  });
});
