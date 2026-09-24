import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Who hears about what: runs the real actions against a throwaway database.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-notify-${process.pid}-${Date.now()}.db`;
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
    SESSION_COOKIE: "tamam_session",
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
import { seedDefaultWorkflow } from "@/lib/workflow";
import { updateIssueStatusAndOrder, updateIssue } from "@/lib/actions/issues";
import { addComment } from "@/lib/actions/comments";
import { completeSprint, moveIssueToSprint } from "@/lib/actions/sprints";
import { removeProjectMember } from "@/lib/actions/access";

let adminId: string;
let assigneeId: string;
let watcherId: string;
let leaverId: string;
let projectId: string;
let n = 0;

async function issue(status = "TODO", sprintId: string | null = null) {
  n++;
  const created = await prisma.issue.create({
    data: {
      key: `NOT-${n}`,
      title: `Issue ${n}`,
      status,
      sprintId,
      projectId,
      reporterId: adminId,
      assigneeId,
    },
  });
  await prisma.watcher.createMany({
    data: [watcherId, assigneeId].map((userId) => ({ issueId: created.id, userId })),
  });
  return created;
}

async function inbox(userId: string) {
  const rows = await prisma.notification.findMany({ where: { userId }, select: { title: true } });
  return rows.map((r) => r.title);
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const [admin, assignee, watcher, leaver] = await Promise.all(
    ["admin", "assignee", "watcher", "leaver"].map((name) =>
      prisma.user.create({ data: { name, email: `${name}@x.dev` } })
    )
  );
  const project = await prisma.project.create({ data: { name: "Notify", key: "NOT", leadId: admin.id } });
  await prisma.projectMember.createMany({
    data: [admin, assignee, watcher, leaver].map((u) => ({
      projectId: project.id,
      userId: u.id,
      role: u.id === admin.id ? "ADMIN" : "MEMBER",
    })),
  });
  await seedDefaultWorkflow(prisma, project.id);
  adminId = admin.id;
  assigneeId = assignee.id;
  watcherId = watcher.id;
  leaverId = leaver.id;
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

beforeEach(async () => {
  session.userId = adminId;
  await prisma.notification.deleteMany();
});

describe("status changes reach the assignee and watchers on every path (AUDIT-22)", () => {
  it("board drag", async () => {
    const i = await issue("TODO");
    expect((await updateIssueStatusAndOrder(i.id, "IN_PROGRESS", 0)).success).toBe(true);
    expect(await inbox(watcherId)).toEqual([`${i.key} moved to In Progress`]);
    // The assignee also watches, but hears about it once.
    expect(await inbox(assigneeId)).toEqual([`${i.key} moved to In Progress`]);
    // The person who moved it isn't told about their own change.
    expect(await inbox(adminId)).toEqual([]);
  });

  it("the issue's status field", async () => {
    const i = await issue("TODO");
    expect((await updateIssue(i.id, { status: "IN_PROGRESS" })).success).toBe(true);
    expect(await inbox(watcherId)).toEqual([`${i.key} moved to In Progress`]);
  });

  it("moving between backlog and a sprint", async () => {
    const s = await prisma.sprint.create({ data: { name: "S", status: "FUTURE", projectId } });
    const i = await issue("BACKLOG");
    expect((await moveIssueToSprint(i.id, s.id)).success).toBe(true);
    expect(await inbox(watcherId)).toEqual([`${i.key} moved to To Do`]);
  });

  it("completing a sprint", async () => {
    const s = await prisma.sprint.create({ data: { name: "S2", status: "ACTIVE", projectId } });
    const open = await issue("IN_PROGRESS", s.id);
    await issue("DONE", s.id);
    expect((await completeSprint(s.id)).success).toBe(true);
    // Only the issue that actually changed status.
    expect(await inbox(watcherId)).toEqual([`${open.key} moved to Backlog`]);
  });
});

describe("only people who can still see the project are notified (AUDIT-19)", () => {
  it("removing a member stops their notifications and drops their watches", async () => {
    const i = await issue("TODO");
    await prisma.watcher.create({ data: { issueId: i.id, userId: leaverId } });

    expect((await removeProjectMember(projectId, leaverId)).success).toBe(true);
    expect(await prisma.watcher.count({ where: { userId: leaverId } })).toBe(0);

    // Even a watch that somehow survives is filtered when sending.
    await prisma.watcher.create({ data: { issueId: i.id, userId: leaverId } });
    await addComment(i.id, adminId, "a private detail");
    await updateIssueStatusAndOrder(i.id, "IN_REVIEW", 0);

    expect(await inbox(leaverId)).toEqual([]);
    expect(await inbox(watcherId)).toHaveLength(2);
  });
});
