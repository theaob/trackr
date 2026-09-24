import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    project: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    activityLog: { createMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: db }));

import { notifyMentions } from "@/lib/mentions";

const ada = { id: "u1", name: "Ada Lovelace" };
const grace = { id: "u2", name: "Grace Hopper" };
const linus = { id: "u3", name: "Linus Pauling" };
const issue = { id: "i1", key: "APOLLO-7", projectId: "p1", projectKey: "APOLLO" };

beforeEach(() => {
  vi.clearAllMocks();
  db.project.findUnique.mockResolvedValue({ leadId: "u1", allowAnonymousViewers: false });
  // Members and the lead of a private project; everyone for a public one.
  db.user.findMany.mockImplementation(async ({ where }: { where?: unknown }) => (where ? [ada, grace] : [ada, grace, linus]));
});

describe("mention notifications", () => {
  it("tells everyone mentioned who can open the issue, but not the author", async () => {
    const notified = await notifyMentions({
      issue,
      text: "@Ada Lovelace and @Grace, see @Linus Pauling's note",
      actor: ada,
      where: "comment",
    });
    expect(notified).toEqual(["u2"]);
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "u2",
          title: "Mentioned in a comment on APOLLO-7",
          message: expect.stringContaining("Ada Lovelace mentioned you"),
          link: "/projects/APOLLO/issues/APOLLO-7",
        },
      ],
    });
    // Linus isn't on the project, so the private project's candidates leave him out.
    expect(db.user.findMany.mock.calls[0][0].where).toBeTruthy();
  });

  it("reaches anyone signed up when the project is public", async () => {
    db.project.findUnique.mockResolvedValue({ leadId: null, allowAnonymousViewers: true });
    const notified = await notifyMentions({ issue, text: "cc @Linus", actor: ada, where: "description" });
    expect(notified).toEqual(["u3"]);
    expect(db.notification.createMany.mock.calls[0][0].data[0].title).toBe("Mentioned in APOLLO-7");
  });

  it("on an edit, only tells people the edit added", async () => {
    const notified = await notifyMentions({
      issue,
      text: "@Grace and @Ada",
      previousText: "@Grace",
      actor: linus,
      where: "comment",
    });
    expect(notified).toEqual(["u1"]);
  });

  it("does nothing without a mention", async () => {
    expect(await notifyMentions({ issue, text: "email grace@example.com", actor: ada, where: "comment" })).toEqual([]);
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});
