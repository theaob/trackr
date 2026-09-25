import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real workflow actions against a throwaway database.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-transitions-${process.pid}-${Date.now()}.db`;
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
import { allowEveryTransition, setStatusTransitions } from "@/lib/actions/workflows";

let projectId: string;
let otherProjectStatusId: string;
let adminId: string;
let memberId: string;
const ids: Record<string, string> = {};

async function moves() {
  const rows = await prisma.workflowTransition.findMany({ where: { projectId } });
  const name = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  return rows.map((t) => `${name[t.fromId]}>${name[t.toId]}`).sort();
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const admin = await prisma.user.create({ data: { name: "Admin", email: "admin@x.dev" } });
  const member = await prisma.user.create({ data: { name: "Member", email: "member@x.dev" } });
  const project = await prisma.project.create({ data: { name: "Moves", key: "MOV", leadId: admin.id } });
  const other = await prisma.project.create({ data: { name: "Other", key: "OTH", leadId: admin.id } });
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: admin.id, role: "ADMIN" },
      { projectId: project.id, userId: member.id, role: "MEMBER" },
    ],
  });
  for (const p of [project.id, other.id]) {
    await prisma.workflowStatus.createMany({
      data: ["A", "B", "C"].map((name, order) => ({ projectId: p, name, category: "TODO", order, color: "#64748b" })),
    });
  }
  for (const s of await prisma.workflowStatus.findMany({ where: { projectId: project.id } })) ids[s.name] = s.id;
  otherProjectStatusId = (await prisma.workflowStatus.findFirstOrThrow({ where: { projectId: other.id } })).id;
  projectId = project.id;
  adminId = admin.id;
  memberId = member.id;
});

beforeEach(async () => {
  session.userId = adminId;
  await prisma.workflowTransition.deleteMany({ where: { projectId } });
  await prisma.workflowTransition.createMany({
    data: [
      { projectId, fromId: ids.A, toId: ids.B },
      { projectId, fromId: ids.B, toId: ids.C },
      { projectId, fromId: ids.C, toId: ids.A },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

describe("setStatusTransitions", () => {
  it("gives a status exactly the moves asked for, both ways, and leaves other moves alone", async () => {
    const res = await setStatusTransitions(projectId, ids.B, { to: [ids.A, ids.C], from: [ids.C] });
    expect(res.success).toBe(true);
    expect(await moves()).toEqual(["B>A", "B>C", "C>A", "C>B"]);
  });

  it("clears a status's moves when given none", async () => {
    await setStatusTransitions(projectId, ids.B, { to: [], from: [] });
    expect(await moves()).toEqual(["C>A"]);
  });

  it("ignores the status itself, duplicates, and statuses from another project", async () => {
    const res = await setStatusTransitions(projectId, ids.A, {
      to: [ids.A, ids.B, ids.B, otherProjectStatusId],
      from: [otherProjectStatusId],
    });
    expect(res.success).toBe(true);
    expect(await moves()).toEqual(["A>B", "B>C"]);
  });

  it("refuses a status from another project", async () => {
    const res = await setStatusTransitions(projectId, otherProjectStatusId, { to: [ids.A], from: [] });
    expect(res.success).toBe(false);
    expect(await moves()).toEqual(["A>B", "B>C", "C>A"]);
  });

  it("is for project administrators only", async () => {
    session.userId = memberId;
    const res = await setStatusTransitions(projectId, ids.A, { to: [], from: [] });
    expect(res.success).toBe(false);
    expect(await moves()).toEqual(["A>B", "B>C", "C>A"]);
  });
});

describe("allowEveryTransition", () => {
  it("adds the missing moves between every two statuses, keeping the ones there", async () => {
    expect((await allowEveryTransition(projectId)).success).toBe(true);
    expect(await moves()).toEqual(["A>B", "A>C", "B>A", "B>C", "C>A", "C>B"]);
    // Running it again changes nothing.
    expect((await allowEveryTransition(projectId)).success).toBe(true);
    expect(await moves()).toHaveLength(6);
  });

  it("is for project administrators only", async () => {
    session.userId = memberId;
    expect((await allowEveryTransition(projectId)).success).toBe(false);
    expect(await moves()).toHaveLength(3);
  });
});
