import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, session } = vi.hoisted(() => ({
  db: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: { user: { id: "u1" } as { id: string } | null },
}));
vi.mock("@/lib/db", () => ({ default: { savedView: db } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => session.user) }));

import { createSavedView, deleteSavedView, listSavedViews, updateSavedView } from "@/lib/actions/savedViews";

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { id: "u1" };
  db.count.mockResolvedValue(0);
  db.create.mockImplementation(async ({ data }) => ({ id: "v1", ...data }));
  db.update.mockImplementation(async ({ where, data }) => ({ id: where.id, name: "x", tql: "", columns: "[]", ...data }));
});

describe("saved views", () => {
  it("lists only the caller's views, with columns read back safely", async () => {
    db.findMany.mockResolvedValue([{ id: "v1", name: "Bugs", tql: 'type = "BUG"', columns: '["status","nope"]' }]);
    const views = await listSavedViews();
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(views[0].columns).toEqual(["key", "title", "status"]);
  });

  it("gives visitors who aren't signed in no views and lets them save none", async () => {
    session.user = null;
    expect(await listSavedViews()).toEqual([]);
    expect((await createSavedView({ name: "x", tql: "", columns: [] })).success).toBe(false);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("saves a trimmed name, a valid query and known columns", async () => {
    const res = await createSavedView({ name: "  My bugs ", tql: 'type = "BUG" ORDER BY updated DESC', columns: ["status"] });
    expect(res.success).toBe(true);
    expect(db.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "My bugs", tql: 'type = "BUG" ORDER BY updated DESC', columns: JSON.stringify(["key", "title", "status"]) },
    });
  });

  it("refuses an empty name, a broken query and a 51st view", async () => {
    expect(await createSavedView({ name: " ", tql: "", columns: [] })).toMatchObject({ success: false, error: "Give the view a name." });
    expect(await createSavedView({ name: "x", tql: "status = ", columns: [] })).toMatchObject({ success: false });
    db.count.mockResolvedValue(50);
    expect(await createSavedView({ name: "x", tql: "", columns: [] })).toMatchObject({ success: false });
    expect(db.create).not.toHaveBeenCalled();
  });

  it("only changes or deletes the caller's own views", async () => {
    db.findFirst.mockResolvedValue(null);
    expect((await updateSavedView("someone-elses", { name: "Mine now" })).success).toBe(false);
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "someone-elses", userId: "u1" } });
    expect(db.update).not.toHaveBeenCalled();

    db.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteSavedView("someone-elses")).success).toBe(false);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: "someone-elses", userId: "u1" } });
  });
});
