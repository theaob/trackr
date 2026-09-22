import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compareIssueKeys, createIssueWithKey } from "@/lib/issueKeys";

const findMany = vi.fn();
const count = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  default: {
    issue: {
      get findMany() {
        return findMany;
      },
      get count() {
        return count;
      },
    },
    get $queryRaw() {
      return queryRaw;
    },
  },
}));

function duplicateKeyError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
});

describe("createIssueWithKey", () => {
  it("uses the highest existing number plus one", async () => {
    queryRaw.mockResolvedValue([{ maxNum: 41 }]);

    const key = await createIssueWithKey("p1", "APOLLO", (k) => Promise.resolve(k) as any);
    expect(key).toBe("APOLLO-42");
  });

  // The old scheme used a row count, so deleting an issue made the next create
  // reuse a key that already existed.
  it("is not confused by deleted issues", async () => {
    queryRaw.mockResolvedValue([{ maxNum: 100 }]);
    count.mockResolvedValue(3); // only three rows remain

    const key = await createIssueWithKey("p2", "VOY", (k) => Promise.resolve(k) as any);
    expect(key).toBe("VOY-101");
  });

  it("retries the next number when the key is taken", async () => {
    queryRaw.mockResolvedValue([{ maxNum: 7 }]);

    const taken = new Set(["ORION-8", "ORION-9"]);
    const attempted: string[] = [];

    const key = await createIssueWithKey("p3", "ORION", (k) => {
      attempted.push(k);
      if (taken.has(k)) return Promise.reject(duplicateKeyError()) as any;
      return Promise.resolve(k) as any;
    });

    expect(attempted).toEqual(["ORION-8", "ORION-9", "ORION-10"]);
    expect(key).toBe("ORION-10");
  });

  it("propagates errors that are not key collisions", async () => {
    queryRaw.mockResolvedValue([{ maxNum: 1 }]);

    await expect(
      createIssueWithKey("p4", "APOLLO", () => Promise.reject(new Error("disk full")) as any)
    ).rejects.toThrow("disk full");
  });

  it("gives every concurrent create a distinct key", async () => {
    let highest = 5;
    queryRaw.mockImplementation(() => Promise.resolve([{ maxNum: highest }]));

    const issued: string[] = [];
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        createIssueWithKey("p5", "APOLLO", (k) => {
          const number = parseInt(k.split("-")[1], 10);
          if (number <= highest) return Promise.reject(duplicateKeyError()) as any;
          highest = number;
          issued.push(k);
          return Promise.resolve(k) as any;
        })
      )
    );

    expect(new Set(results).size).toBe(20);
    expect(issued).toHaveLength(20);
  });

  it("falls back to the row count when the max query fails", async () => {
    queryRaw.mockRejectedValue(new Error("no such function"));
    count.mockResolvedValue(12);

    const key = await createIssueWithKey("p6", "APOLLO", (k) => Promise.resolve(k) as any);
    expect(key).toBe("APOLLO-13");
  });
});

describe("compareIssueKeys", () => {
  it("orders by number, not by string, once past single digits", () => {
    const keys = ["APOLLO-2", "APOLLO-10", "APOLLO-1", "APOLLO-11", "APOLLO-9"];
    expect(keys.slice().sort(compareIssueKeys)).toEqual([
      "APOLLO-1",
      "APOLLO-2",
      "APOLLO-9",
      "APOLLO-10",
      "APOLLO-11",
    ]);
  });

  it("groups by project prefix before comparing numbers", () => {
    const keys = ["VOY-2", "APOLLO-10", "VOY-1", "APOLLO-2"];
    expect(keys.slice().sort(compareIssueKeys)).toEqual([
      "APOLLO-2",
      "APOLLO-10",
      "VOY-1",
      "VOY-2",
    ]);
  });

  it("falls back to a plain string compare for keys with no numeric suffix", () => {
    const keys = ["banana", "apple"];
    expect(keys.slice().sort(compareIssueKeys)).toEqual(["apple", "banana"]);
  });
});
