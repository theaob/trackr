import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Issue keys, log retention and cross-project status colors, run through the
// real actions against a throwaway database. Webhook requests never leave the
// process.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/trackr-retention-${process.pid}-${Date.now()}.db`;
  process.env.DATABASE_URL = `file:${file}`;
  return file;
});
const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/webhookUrl", () => ({ checkWebhookUrl: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/webhookDelivery", () => ({
  postWebhook: vi.fn(async () => ({ status: 200, body: "ok" })),
}));
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
import { createIssue, deleteIssue, getIssueByKeyOrId } from "@/lib/actions/issues";
import { createIssueLink } from "@/lib/actions/issueLinks";
import { testWebhook } from "@/lib/actions/webhooks";
import { notifyUsers } from "@/lib/notify";

const DAY_MS = 24 * 60 * 60 * 1000;
let userId: string;
let projectId: string;

async function newIssue(title: string, project = projectId) {
  const res = await createIssue({ title, type: "TASK", projectId: project });
  if (!res.success || !("issue" in res) || !res.issue) throw new Error(`createIssue failed: ${JSON.stringify(res)}`);
  return res.issue as { id: string; key: string };
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const user = await prisma.user.create({ data: { name: "U", email: "u@x.dev", isInstanceAdmin: true } });
  const project = await prisma.project.create({ data: { name: "Keys", key: "KEY", leadId: user.id } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, role: "ADMIN" } });
  await seedDefaultWorkflow(prisma, project.id);
  session.userId = user.id;
  userId = user.id;
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

describe("issue keys are never handed out twice (AUDIT-27)", () => {
  it("skips the key of a deleted newest issue", async () => {
    await newIssue("one");
    const second = await newIssue("two");
    expect(second.key).toBe("KEY-2");
    expect((await deleteIssue(second.id)).success).toBe(true);

    expect((await newIssue("three")).key).toBe("KEY-3");
    expect(await getIssueByKeyOrId("KEY-2")).toBeNull();
  });
});

describe("log retention (AUDIT-28)", () => {
  it("keeps the latest 100 deliveries per webhook", async () => {
    const webhook = await prisma.webhook.create({
      data: { name: "hook", url: "https://hooks.example.com/in", events: "[]", projectId },
    });
    const old = new Date(Date.now() - DAY_MS);
    await prisma.webhookDelivery.createMany({
      data: Array.from({ length: 105 }, () => ({
        webhookId: webhook.id,
        event: "issue:updated",
        url: webhook.url,
        status: 200,
        success: true,
        durationMs: 1,
        requestPayload: "{}",
        createdAt: old,
      })),
    });

    const res = await testWebhook(webhook.id);
    expect(res.success).toBe(true);

    const kept = await prisma.webhookDelivery.findMany({ where: { webhookId: webhook.id } });
    expect(kept).toHaveLength(100);
    expect(kept.some((d) => d.id === res.deliveryId)).toBe(true);
  });

  it("drops read notifications after 90 days and every notification after a year", async () => {
    const at = (days: number) => new Date(Date.now() - days * DAY_MS);
    const note = { userId, title: "t", message: "m", link: "/" };
    await prisma.notification.createMany({
      data: [
        { ...note, title: "read, recent", read: true, createdAt: at(10) },
        { ...note, title: "read, old", read: true, createdAt: at(100) },
        { ...note, title: "unread, old", read: false, createdAt: at(100) },
        { ...note, title: "unread, ancient", read: false, createdAt: at(400) },
      ],
    });

    await notifyUsers(projectId, [userId], { title: "fresh", message: "m", link: "/" });

    const titles = (await prisma.notification.findMany({ where: { userId } })).map((n) => n.title).sort();
    expect(titles).toEqual(["fresh", "read, recent", "unread, old"]);
  });
});

describe("linked issues use their own project's status colors (AUDIT-31)", () => {
  it("colors a link target by the workflow of the project it lives in", async () => {
    const other = await prisma.project.create({ data: { name: "Other", key: "OTH", leadId: userId } });
    await prisma.projectMember.create({ data: { projectId: other.id, userId, role: "ADMIN" } });
    await seedDefaultWorkflow(prisma, other.id);
    const here = await newIssue("here");
    const there = await newIssue("there", other.id);
    const { status } = await prisma.issue.findUniqueOrThrow({ where: { id: there.id } });
    await prisma.workflowStatus.updateMany({
      where: { projectId: other.id, name: status },
      data: { color: "#ABCDEF" },
    });

    const created = await createIssueLink({ issueId: here.id, targetIssueId: there.id, type: "RELATES_TO" });
    expect(created.success).toBe(true);
    expect(created.success && created.link.target.statusColor).toBe("#ABCDEF");

    const loaded = (await getIssueByKeyOrId(here.key)) as any;
    const target = loaded.linksAsSource[0].target;
    expect(target?.statusColor).toBe("#ABCDEF");
    expect(target?.statusColor).not.toBe(
      (await prisma.workflowStatus.findFirstOrThrow({ where: { projectId, name: status } })).color
    );
  });
});
