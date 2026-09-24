import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A custom role granted Project Admin can moderate other people's content,
// exactly like the built-in Administrator; one without it can't.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-moderation-${process.pid}-${Date.now()}.db`;
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
import { deleteComment, updateComment } from "@/lib/actions/comments";
import { deleteWorklog } from "@/lib/actions/worklogs";
import { deleteIssue } from "@/lib/actions/issues";

let authorId: string;
let moderatorId: string;
let helperId: string;
let projectId: string;
let n = 0;

async function authoredContent() {
  n++;
  const issue = await prisma.issue.create({
    data: { key: `MOD-${n}`, title: "t", status: "TODO", projectId, reporterId: authorId },
  });
  const comment = await prisma.comment.create({ data: { content: "hi", issueId: issue.id, authorId } });
  const worklog = await prisma.worklog.create({ data: { issueId: issue.id, authorId, timeSpentSeconds: 60 } });
  return { issue, comment, worklog };
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const [author, moderator, helper] = await Promise.all(
    ["author", "moderator", "helper"].map((name) =>
      prisma.user.create({ data: { name, email: `${name}@x.dev` } })
    )
  );
  const project = await prisma.project.create({ data: { name: "Mod", key: "MOD", leadId: author.id } });
  const [modRole, helperRole] = await Promise.all([
    prisma.customRole.create({
      data: {
        projectId: project.id,
        name: "Moderator",
        permissions: JSON.stringify(["VIEW_PROJECT", "DELETE_ISSUE", "PROJECT_ADMIN"]),
      },
    }),
    prisma.customRole.create({
      data: {
        projectId: project.id,
        name: "Helper",
        permissions: JSON.stringify(["VIEW_PROJECT", "DELETE_ISSUE"]),
      },
    }),
  ]);
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: author.id, role: "MEMBER" },
      { projectId: project.id, userId: moderator.id, role: "Moderator", customRoleId: modRole.id },
      { projectId: project.id, userId: helper.id, role: "Helper", customRoleId: helperRole.id },
    ],
  });
  authorId = author.id;
  moderatorId = moderator.id;
  helperId = helper.id;
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

beforeEach(() => {
  session.userId = null;
});

describe("moderation by a custom role", () => {
  it("lets a role holding Project Admin edit and delete other people's content", async () => {
    const { issue, comment, worklog } = await authoredContent();
    session.userId = moderatorId;

    expect((await updateComment(comment.id, "edited")).success).toBe(true);
    expect((await deleteComment(comment.id)).success).toBe(true);
    expect((await deleteWorklog(worklog.id)).success).toBe(true);
    expect((await deleteIssue(issue.id)).success).toBe(true);
    expect(await prisma.issue.count({ where: { id: issue.id } })).toBe(0);
  });

  it("still refuses a role without Project Admin", async () => {
    const { issue, comment, worklog } = await authoredContent();
    session.userId = helperId;

    expect((await updateComment(comment.id, "edited")).success).toBe(false);
    expect((await deleteComment(comment.id)).success).toBe(false);
    expect((await deleteWorklog(worklog.id)).success).toBe(false);
    expect((await deleteIssue(issue.id)).success).toBe(false);
    expect(await prisma.issue.count({ where: { id: issue.id } })).toBe(1);
  });
});
