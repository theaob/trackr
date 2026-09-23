import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the real workflow and report actions against a throwaway database.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/trackr-status-colors-${process.pid}-${Date.now()}.db`;
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
import { CATEGORY_COLORS, UNSET_STATUS_COLOR } from "@/lib/statusColors";
import { createWorkflowStatus, getProjectWorkflow, updateWorkflowStatus } from "@/lib/actions/workflows";
import { getCumulativeFlowReport, getEpicProgressReport } from "@/lib/actions/reports";

let projectId: string;
let adminId: string;

async function colorOf(name: string) {
  const s = await prisma.workflowStatus.findFirstOrThrow({ where: { projectId, name } });
  return s.color;
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const admin = await prisma.user.create({ data: { name: "Admin", email: "admin@x.dev" } });
  const project = await prisma.project.create({ data: { name: "Colors", key: "COL", leadId: admin.id } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: admin.id, role: "ADMIN" } });
  await seedDefaultWorkflow(prisma, project.id);
  projectId = project.id;
  adminId = admin.id;
  session.userId = admin.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

describe("status colors", () => {
  // Runs first: the backfill happens once, on the first workflow read.
  it("gives statuses left on the old gray their category's color, and leaves picked colors alone", async () => {
    await prisma.workflowStatus.createMany({
      data: [
        { projectId, name: "Old QA", category: "IN_PROGRESS", color: UNSET_STATUS_COLOR, order: 10 },
        // The same gray, but chosen in the color picker (which reports lowercase).
        { projectId, name: "Picked Gray", category: "IN_PROGRESS", color: "#6b7280", order: 11 },
      ],
    });

    await getProjectWorkflow(projectId);

    expect(await colorOf("Old QA")).toBe(CATEGORY_COLORS.IN_PROGRESS);
    expect(await colorOf("Picked Gray")).toBe("#6b7280");
  });

  it("starts a new status with its category's color", async () => {
    const res = await createWorkflowStatus(projectId, { name: "Code Review", category: "IN_PROGRESS" });
    expect(res.success).toBe(true);
    expect(await colorOf("Code Review")).toBe(CATEGORY_COLORS.IN_PROGRESS);
  });

  it("moves an uncustomized color along with the category, but keeps a picked one", async () => {
    const status = await prisma.workflowStatus.findFirstOrThrow({ where: { projectId, name: "Code Review" } });

    await updateWorkflowStatus(status.id, { category: "DONE" });
    expect(await colorOf("Code Review")).toBe(CATEGORY_COLORS.DONE);

    await updateWorkflowStatus(status.id, { color: "#ff8800" });
    await updateWorkflowStatus(status.id, { category: "TODO" });
    expect(await colorOf("Code Review")).toBe("#ff8800");
  });

  it("colors report bands and epic bars with each status's own color", async () => {
    await prisma.workflowStatus.updateMany({
      where: { projectId, name: "Code Review" },
      data: { category: "IN_PROGRESS" },
    });
    const epic = await prisma.issue.create({
      data: { key: "COL-1", title: "Epic", type: "EPIC", status: "TODO", projectId, reporterId: adminId },
    });
    await prisma.issue.createMany({
      data: [
        { key: "COL-2", title: "a", status: "Code Review", projectId, reporterId: adminId, parentId: epic.id },
        { key: "COL-3", title: "b", status: "DONE", projectId, reporterId: adminId, parentId: epic.id },
      ],
    });

    const flow = await getCumulativeFlowReport(projectId, 7);
    const band = flow?.statuses?.find((s) => s.name === "Code Review");
    expect(band?.color).toBe("#ff8800");
    // Done at the bottom of the stack.
    expect(flow?.statuses?.[0].name).toBe("DONE");

    const [progress] = await getEpicProgressReport(projectId);
    expect(progress.segments).toEqual([
      { name: "DONE", color: await colorOf("DONE"), issues: 1, points: 0 },
      { name: "Code Review", color: "#ff8800", issues: 1, points: 0 },
    ]);
  });
});
