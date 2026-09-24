import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Runs the real /api/v1/issues handler against a throwaway SQLite database.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-restapi-${process.pid}-${Date.now()}.db`;
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
import { createPersonalAccessToken } from "@/lib/actions/tokens";
import { GET } from "@/app/api/v1/issues/route";

let tokens: { outsider: string; teammate: string };

async function tokenFor(userId: string) {
  session.userId = userId;
  const res = await createPersonalAccessToken({ name: "test", expirationDays: null });
  if (!res.success || !res.token) throw new Error("could not mint token");
  return res.token;
}

async function listIssues(token: string) {
  const res = await GET(
    new NextRequest("http://localhost/api/v1/issues", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
  expect(res.status).toBe(200);
  return (await res.json()).issues as {
    key: string;
    assignee: { id: string; name: string; email?: string } | null;
  }[];
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );

  const assignee = await prisma.user.create({ data: { name: "Ada", email: "ada@team.dev" } });
  const teammate = await prisma.user.create({ data: { name: "Tom", email: "tom@team.dev" } });
  const outsider = await prisma.user.create({ data: { name: "Olga", email: "olga@else.dev" } });

  const published = await prisma.project.create({
    data: { name: "Public", key: "PUB", leadId: assignee.id, allowAnonymousViewers: true },
  });
  const internal = await prisma.project.create({
    data: { name: "Internal", key: "INT", leadId: assignee.id },
  });
  for (const project of [published, internal]) {
    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: assignee.id, role: "ADMIN" },
        { projectId: project.id, userId: teammate.id, role: "MEMBER" },
      ],
    });
    await prisma.issue.create({
      data: {
        key: `${project.key}-1`,
        title: "Task",
        projectId: project.id,
        reporterId: assignee.id,
        assigneeId: assignee.id,
      },
    });
  }

  tokens = { outsider: await tokenFor(outsider.id), teammate: await tokenFor(teammate.id) };
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

describe("REST API issue listing (AUDIT-3)", () => {
  it("lets anyone read a published project, without its team's emails", async () => {
    const issues = await listIssues(tokens.outsider);
    expect(issues.map((i) => i.key)).toEqual(["PUB-1"]);
    expect(issues[0].assignee).toEqual({ id: expect.any(String), name: "Ada" });
    expect(JSON.stringify(issues)).not.toContain("ada@team.dev");
  });

  it("still gives teammates the emails on their own projects", async () => {
    const issues = await listIssues(tokens.teammate);
    expect(issues.map((i) => i.key).sort()).toEqual(["INT-1", "PUB-1"]);
    for (const issue of issues) expect(issue.assignee?.email).toBe("ada@team.dev");
  });
});
