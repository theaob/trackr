import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/trackr-history-paging-${process.pid}-${Date.now()}.db`;
  process.env.DATABASE_URL = `file:${file}`;
  return file;
});
const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", async () => {
  const { PUBLIC_USER_SELECT } = await import("@/lib/auth/publicUser");
  const { default: prisma } = await import("@/lib/db");
  return {
    PUBLIC_USER_SELECT,
    SESSION_COOKIE: "trackr_session",
    startSession: vi.fn(),
    endSession: vi.fn(),
    getCurrentUser: vi.fn(async () =>
      session.userId
        ? prisma.user.findUnique({ where: { id: session.userId }, select: PUBLIC_USER_SELECT })
        : null
    ),
  };
});

import prisma from "@/lib/db";
import { getIssueByKeyOrId, getOlderIssueHistory } from "@/lib/actions/issues";
import { getSprintOptions } from "@/lib/actions/sprints";
import {
  historyRemaining,
  historyTotal,
  oldestLoadedId,
  withCommentCountChange,
  withOlderHistory,
} from "@/lib/issueHistory";

let issueId: string;
let projectId: string;

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const user = await prisma.user.create({ data: { name: "U", email: "u@x.dev" } });
  const project = await prisma.project.create({ data: { name: "Paging", key: "PAG", leadId: user.id } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, role: "ADMIN" } });
  const issue = await prisma.issue.create({
    data: { key: "PAG-1", title: "Busy", status: "TODO", projectId: project.id, reporterId: user.id },
  });
  const base = Date.UTC(2026, 0, 1);
  await prisma.comment.createMany({
    data: Array.from({ length: 120 }, (_, i) => ({
      issueId: issue.id,
      authorId: user.id,
      content: `comment ${i}`,
      createdAt: new Date(base + i * 60_000),
    })),
  });
  await prisma.sprint.createMany({
    data: [
      { name: "Done sprint", status: "COMPLETED", projectId: project.id },
      { name: "Now", status: "ACTIVE", projectId: project.id },
      { name: "Next", status: "FUTURE", projectId: project.id },
    ],
  });
  session.userId = user.id;
  issueId = issue.id;
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

describe("issue history paging (AUDIT-29)", () => {
  it("loads the latest 50 comments with a total, then pages through the rest in order", async () => {
    let issue = (await getIssueByKeyOrId("PAG-1")) as any;
    expect(issue.comments).toHaveLength(50);
    expect(issue.comments[0].content).toBe("comment 119");
    expect(historyTotal(issue, "comments")).toBe(120);
    expect(historyRemaining(issue, "comments")).toBe(70);

    for (const expected of [50, 20]) {
      const older = await getOlderIssueHistory(issueId, "comments", oldestLoadedId(issue, "comments")!);
      expect(older).toHaveLength(expected);
      issue = withOlderHistory(issue, "comments", older);
    }

    const contents = issue.comments.map((c: any) => c.content);
    expect(contents).toHaveLength(120);
    expect(new Set(contents).size).toBe(120);
    expect(contents[119]).toBe("comment 0");
    expect(historyRemaining(issue, "comments")).toBe(0);
  });

  it("keeps the total right as comments are added and deleted on the client", () => {
    const issue = { comments: [{ id: "a" }], _count: { comments: 10, activityLogs: 0 } } as any;
    expect(historyTotal(withCommentCountChange(issue, 1), "comments")).toBe(11);
    expect(historyTotal(withCommentCountChange(issue, -1), "comments")).toBe(9);
  });

  it("refuses to page an issue the caller can't see", async () => {
    session.userId = null;
    expect(await getOlderIssueHistory(issueId, "comments", "whatever")).toEqual([]);
    const outsider = await prisma.user.create({ data: { name: "O", email: "o@x.dev" } });
    session.userId = outsider.id;
    const first = await prisma.comment.findFirstOrThrow({ where: { issueId } });
    expect(await getOlderIssueHistory(issueId, "comments", first.id)).toEqual([]);
  });
});

describe("sprint options for the project layout (AUDIT-21)", () => {
  it("lists open sprints only, without their issues", async () => {
    const lead = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { leadId: true } });
    session.userId = lead.leadId;
    const options = await getSprintOptions(projectId);
    expect(options.map((s) => s.name).sort()).toEqual(["Next", "Now"]);
    expect(Object.keys(options[0]).sort()).toEqual(["endDate", "id", "name", "projectId", "startDate", "status"]);
  });
});
