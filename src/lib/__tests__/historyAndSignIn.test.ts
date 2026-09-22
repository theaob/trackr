import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real sprint, workflow and sign-in actions against a throwaway
// SQLite database; only the cookie-based session is replaced.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/trackr-history-${process.pid}-${Date.now()}.db`;
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
import { seedDefaultWorkflow } from "@/lib/workflow";
import { hashPassword } from "@/lib/auth/password";
import { completeSprint, deleteSprint, moveIssueToSprint } from "@/lib/actions/sprints";
import { updateWorkflowStatus } from "@/lib/actions/workflows";
import { loginWithCredentials, registerUser } from "@/lib/actions/auth";
import { setSelfRegistrationOpen } from "@/lib/actions/instanceAdmins";

let adminId: string;
let memberId: string;
let projectId: string;
let issueCounter = 0;

async function makeIssue(status: string, sprintId: string | null) {
  issueCounter++;
  return prisma.issue.create({
    data: { key: `HIS-${issueCounter}`, title: "t", status, sprintId, projectId, reporterId: adminId },
  });
}

async function sprint(status: "FUTURE" | "ACTIVE" | "COMPLETED") {
  return prisma.sprint.create({ data: { name: `S${Math.random()}`, status, projectId } });
}

async function statusHistory(issueId: string) {
  return prisma.activityLog.findMany({
    where: { issueId, action: "STATUS_CHANGED" },
    select: { oldValue: true, newValue: true },
  });
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@x.dev",
      canCreateProjects: true,
      isInstanceAdmin: true,
      passwordHash: await hashPassword("correct horse battery"),
    },
  });
  const member = await prisma.user.create({ data: { name: "Member", email: "member@x.dev" } });
  const project = await prisma.project.create({ data: { name: "History", key: "HIS", leadId: admin.id } });
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: admin.id, role: "ADMIN" },
      { projectId: project.id, userId: member.id, role: "MEMBER" },
    ],
  });
  await seedDefaultWorkflow(prisma, project.id);
  adminId = admin.id;
  memberId = member.id;
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

beforeEach(() => {
  session.userId = adminId;
});

describe("sprint operations record status history (AUDIT-6)", () => {
  it("records each issue sent back to the backlog when a sprint completes", async () => {
    const s = await sprint("ACTIVE");
    const open = await makeIssue("IN_PROGRESS", s.id);
    const done = await makeIssue("DONE", s.id);

    expect((await completeSprint(s.id)).success).toBe(true);

    expect(await statusHistory(open.id)).toEqual([{ oldValue: "IN_PROGRESS", newValue: "BACKLOG" }]);
    expect(await statusHistory(done.id)).toEqual([]);
  });

  it("records the status change when an issue moves between backlog and sprint", async () => {
    const s = await sprint("FUTURE");
    const issue = await makeIssue("BACKLOG", null);

    expect((await moveIssueToSprint(issue.id, s.id)).success).toBe(true);
    expect(await statusHistory(issue.id)).toEqual([{ oldValue: "BACKLOG", newValue: "TODO" }]);
  });
});

describe("deleting a sprint (AUDIT-6, AUDIT-7)", () => {
  it("keeps finished issues finished, and records the rest going back to the backlog", async () => {
    const s = await sprint("FUTURE");
    const done = await makeIssue("DONE", s.id);
    const todo = await makeIssue("TODO", s.id);

    expect((await deleteSprint(s.id)).success).toBe(true);

    const [doneAfter, todoAfter] = await Promise.all([
      prisma.issue.findUnique({ where: { id: done.id } }),
      prisma.issue.findUnique({ where: { id: todo.id } }),
    ]);
    expect(doneAfter).toMatchObject({ status: "DONE", sprintId: null });
    expect(todoAfter).toMatchObject({ status: "BACKLOG", sprintId: null });
    expect(await statusHistory(todo.id)).toEqual([{ oldValue: "TODO", newValue: "BACKLOG" }]);
  });

  it("refuses to delete a completed sprint, even for a direct call", async () => {
    session.userId = memberId; // Members hold MANAGE_SPRINTS.
    const s = await sprint("COMPLETED");
    const done = await makeIssue("DONE", s.id);

    const res = await deleteSprint(s.id);
    expect(res.success).toBe(false);
    expect(await prisma.sprint.count({ where: { id: s.id } })).toBe(1);
    expect((await prisma.issue.findUnique({ where: { id: done.id } }))?.status).toBe("DONE");
  });
});

describe("renaming a status (AUDIT-5)", () => {
  it("carries the project's status history along, so reports still recognise it", async () => {
    const issue = await makeIssue("IN_REVIEW", null);
    await prisma.activityLog.createMany({
      data: [
        { issueId: issue.id, userId: adminId, action: "STATUS_CHANGED", oldValue: "TODO", newValue: "DONE" },
        { issueId: issue.id, userId: adminId, action: "STATUS_CHANGED", oldValue: "DONE", newValue: "IN_REVIEW" },
        { issueId: issue.id, userId: adminId, action: "PRIORITY_CHANGED", oldValue: "DONE", newValue: "HIGH" },
      ],
    });
    const done = await prisma.workflowStatus.findFirstOrThrow({ where: { projectId, name: "DONE" } });

    expect((await updateWorkflowStatus(done.id, { name: "CLOSED" })).success).toBe(true);

    const history = await prisma.activityLog.findMany({
      where: { issueId: issue.id },
      orderBy: { createdAt: "asc" },
      select: { action: true, oldValue: true, newValue: true },
    });
    expect(history).toContainEqual({ action: "STATUS_CHANGED", oldValue: "TODO", newValue: "CLOSED" });
    expect(history).toContainEqual({ action: "STATUS_CHANGED", oldValue: "CLOSED", newValue: "IN_REVIEW" });
    // Other kinds of entries that happen to contain the same text are left alone.
    expect(history).toContainEqual({ action: "PRIORITY_CHANGED", oldValue: "DONE", newValue: "HIGH" });

    // Put the name back for the other tests.
    await updateWorkflowStatus(done.id, { name: "DONE" });
  });
});

describe("sign-in throttling (AUDIT-8)", () => {
  it("locks an account after 10 wrong passwords, even against the right one", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await loginWithCredentials("admin@x.dev", "wrong password");
      expect(res.error).toBe("Incorrect email or password.");
    }
    const blocked = await loginWithCredentials("admin@x.dev", "correct horse battery");
    expect(blocked.success).toBe(false);
    expect(blocked.error).toMatch(/Too many failed attempts/);
  });

  it("throttles unknown emails the same way, so it doesn't reveal which accounts exist", async () => {
    for (let i = 0; i < 10; i++) await loginWithCredentials("nobody@x.dev", "guess");
    const res = await loginWithCredentials("nobody@x.dev", "guess");
    expect(res.error).toMatch(/Too many failed attempts/);
  });

  it("doesn't affect other accounts", async () => {
    await prisma.user.update({
      where: { id: memberId },
      data: { passwordHash: await hashPassword("member password") },
    });
    expect((await loginWithCredentials("member@x.dev", "member password")).success).toBe(true);
  });
});

describe("self-registration switch (AUDIT-8)", () => {
  it("is refused to anyone but an instance admin", async () => {
    session.userId = memberId;
    expect((await setSelfRegistrationOpen(false)).success).toBe(false);
  });

  it("stops new accounts while off, and allows them again when back on", async () => {
    session.userId = adminId;
    expect((await setSelfRegistrationOpen(false)).success).toBe(true);
    const refused = await registerUser({ name: "New", email: "new@x.dev", password: "longenough" });
    expect(refused.success).toBe(false);
    expect(await prisma.user.count({ where: { email: "new@x.dev" } })).toBe(0);

    expect((await setSelfRegistrationOpen(true)).success).toBe(true);
    const allowed = await registerUser({ name: "New", email: "new@x.dev", password: "longenough" });
    expect(allowed.success).toBe(true);
  });
});
