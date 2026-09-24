import crypto from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real session cookies, real password checks, real SSO linking and search,
// against a throwaway database. Only the cookie jar and headers are faked, so
// one test can play two browsers.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-account-${process.pid}-${Date.now()}.db`;
  process.env.DATABASE_URL = `file:${file}`;
  process.env.AUTH_SECRET = "x".repeat(48);
  return file;
});
const browser = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (browser.jar.has(name) ? { value: browser.jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      if (value) browser.jar.set(name, value);
      else browser.jar.delete(name);
    },
  }),
  headers: () => ({ get: () => null }),
}));

import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getCurrentUser, startSession } from "@/lib/auth/session";
import { changePassword, loginWithCredentials, signOutOtherSessions } from "@/lib/actions/auth";
import { loginWithIdToken } from "@/lib/auth/sso";
import { getPaginatedIssues } from "@/lib/actions/issues";

const SECRET = "sso-client-secret";
let userId: string;

/** Switch to a browser holding this cookie jar. */
function useBrowser(jar: Map<string, string>) {
  browser.jar = jar;
}

function idToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ iss: "https://idp.example.com", aud: "tamam", exp: now + 300, iat: now, ...claims })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );
  const user = await prisma.user.create({
    data: {
      name: "Owner",
      email: "owner@x.dev",
      isInstanceAdmin: true,
      passwordHash: await hashPassword("original password"),
    },
  });
  userId = user.id;
  await prisma.ssoConfig.create({
    data: {
      id: "default",
      enabled: true,
      issuerUrl: "https://idp.example.com",
      clientId: "tamam",
      clientSecret: SECRET,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

beforeEach(() => {
  useBrowser(new Map());
});

describe("sessions can be revoked (AUDIT-18)", () => {
  it("signing out elsewhere ends other browsers' sessions but keeps this one", async () => {
    const laptop = new Map<string, string>();
    const phone = new Map<string, string>();
    useBrowser(laptop);
    await startSession(userId);
    useBrowser(phone);
    await startSession(userId);
    expect((await getCurrentUser())?.id).toBe(userId);

    expect((await signOutOtherSessions()).success).toBe(true);
    expect((await getCurrentUser())?.id).toBe(userId);

    useBrowser(laptop);
    expect(await getCurrentUser()).toBeNull();
  });

  it("still accepts cookies from before session versions existed, until the version moves", async () => {
    await prisma.user.update({ where: { id: userId }, data: { sessionVersion: 0 } });
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ uid: userId, iat: now, exp: now + 60 })).toString("base64url");
    const sig = crypto.createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("base64url");
    useBrowser(new Map([["tamam_session", `v1.${payload}.${sig}`]]));
    expect((await getCurrentUser())?.id).toBe(userId);

    await prisma.user.update({ where: { id: userId }, data: { sessionVersion: 1 } });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("changing your password (AUDIT-25)", () => {
  it("needs the current password, signs out other sessions, and the new one works", async () => {
    const other = new Map<string, string>();
    useBrowser(other);
    await startSession(userId);
    const here = new Map<string, string>();
    useBrowser(here);
    await startSession(userId);

    const wrong = await changePassword("not it", "brand new password");
    expect(wrong.success).toBe(false);
    expect(!wrong.success && wrong.error).toMatch(/current password/);

    expect((await changePassword("original password", "short")).success).toBe(false);
    expect((await changePassword("original password", "brand new password")).success).toBe(true);

    expect((await getCurrentUser())?.id).toBe(userId);
    useBrowser(other);
    expect(await getCurrentUser()).toBeNull();

    useBrowser(new Map());
    expect((await loginWithCredentials("owner@x.dev", "original password")).success).toBe(false);
    expect((await loginWithCredentials("owner@x.dev", "brand new password")).success).toBe(true);
  });
});

describe("SSO linking to existing accounts (AUDIT-26)", () => {
  it("won't take over an existing account unless the provider verified the email", async () => {
    const res = await loginWithIdToken(idToken({ sub: "idp-1", email: "owner@x.dev" }));
    expect(res.success).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).ssoSubjectId).toBeNull();

    const verified = await loginWithIdToken(idToken({ sub: "idp-1", email: "owner@x.dev", email_verified: true }));
    expect(verified.success).toBe(true);
  });

  it("still creates new accounts when the claim is missing", async () => {
    const res = await loginWithIdToken(idToken({ sub: "idp-2", email: "newcomer@x.dev" }));
    expect(res.success).toBe(true);
  });

  it("links without the claim once an admin trusts the provider's emails", async () => {
    await prisma.user.create({ data: { name: "Local", email: "local@x.dev" } });
    await prisma.ssoConfig.update({ where: { id: "default" }, data: { trustUnverifiedEmails: true } });
    const res = await loginWithIdToken(idToken({ sub: "idp-3", email: "local@x.dev" }));
    expect(res.success).toBe(true);
    await prisma.ssoConfig.update({ where: { id: "default" }, data: { trustUnverifiedEmails: false } });
  });
});

describe("search can't test emails outside your projects (AUDIT-23)", () => {
  it("matches assignees by email only in projects you belong to", async () => {
    const member = await prisma.user.create({ data: { name: "Mia Member", email: "mia@x.dev" } });
    const project = await prisma.project.create({
      data: { name: "Public", key: "PUB", leadId: member.id, allowAnonymousViewers: true },
    });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id, role: "ADMIN" } });
    await prisma.issue.create({
      data: { key: "PUB-1", title: "t", status: "TODO", projectId: project.id, reporterId: member.id, assigneeId: member.id },
    });

    const search = async (tql: string) =>
      (await getPaginatedIssues({ projectId: project.id, tql, page: 1, pageSize: 10 })).totalCount;

    // A signed-out visitor: by name yes, by email no.
    useBrowser(new Map());
    expect(await search('assignee = "Mia"')).toBe(1);
    expect(await search('assignee = "mia@x.dev"')).toBe(0);
    expect(await search('reporter in ("mia@x.dev")')).toBe(0);

    // A member of the project can still search by email.
    useBrowser(new Map());
    await startSession(member.id);
    expect(await search('assignee = "mia@x.dev"')).toBe(1);
  });
});
