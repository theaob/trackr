import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorityOfRole,
  canManageRoleWithAuthority,
  ROLE_PERMISSIONS,
} from "@/lib/permissions";

// These run the real server actions against a throwaway SQLite database, so
// the checks are exercised exactly as a direct action call would hit them.
// Only the cookie-based session is replaced.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/trackr-escalation-${process.pid}-${Date.now()}.db`;
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
import { requireInstanceAdmin } from "@/lib/auth/guards";
import {
  addProjectMember,
  createCustomRole,
  deleteCustomRole,
  removeProjectMember,
  updateCustomRole,
  updateProjectMemberRole,
} from "@/lib/actions/access";
import { getInstanceUsers, setUserInstanceAdmin } from "@/lib/actions/instanceAdmins";
import { updateUserProjectPermission } from "@/lib/actions/projects";
import { updateSsoConfig, getSsoConfig } from "@/lib/actions/auth";
import { getProjectWebhooks } from "@/lib/actions/webhooks";

const ALL_PERMISSIONS = [...ROLE_PERMISSIONS.ADMIN];

let ids: {
  owner: string;
  projectAdmin: string;
  manager: string;
  member: string;
  outsider: string;
  project: string;
  managerRole: string;
};

function signIn(userId: string) {
  session.userId = userId;
}

async function roleOf(userId: string) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: ids.project, userId } },
    select: { role: true, customRoleId: true },
  });
  return m;
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
    { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
  );

  // Created in order, so `owner` is the oldest account that can create projects.
  const owner = await prisma.user.create({
    data: { name: "Owner", email: "owner@x.dev", canCreateProjects: true },
  });
  const projectAdmin = await prisma.user.create({
    data: { name: "Project Admin", email: "padmin@x.dev" },
  });
  const manager = await prisma.user.create({ data: { name: "Manager", email: "mgr@x.dev" } });
  const member = await prisma.user.create({ data: { name: "Member", email: "member@x.dev" } });
  const outsider = await prisma.user.create({ data: { name: "Outsider", email: "out@x.dev" } });

  const project = await prisma.project.create({
    data: { name: "Apollo", key: "APOLLO", leadId: owner.id },
  });
  const managerRole = await prisma.customRole.create({
    data: {
      projectId: project.id,
      name: "Team Manager",
      permissions: JSON.stringify(["VIEW_PROJECT", "MANAGE_ACCESS", "CREATE_ISSUE"]),
    },
  });
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: owner.id, role: "ADMIN" },
      { projectId: project.id, userId: projectAdmin.id, role: "ADMIN" },
      { projectId: project.id, userId: manager.id, role: "Team Manager", customRoleId: managerRole.id },
      { projectId: project.id, userId: member.id, role: "MEMBER" },
    ],
  });

  ids = {
    owner: owner.id,
    projectAdmin: projectAdmin.id,
    manager: manager.id,
    member: member.id,
    outsider: outsider.id,
    project: project.id,
    managerRole: managerRole.id,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
});

beforeEach(() => {
  session.userId = null;
});

describe("role ceiling rule", () => {
  const admin = { isAdmin: true, permissions: ALL_PERMISSIONS };
  const manager = authorityOfRole("Team Manager", [
    { id: "r1", name: "Team Manager", permissions: '["VIEW_PROJECT","MANAGE_ACCESS","CREATE_ISSUE"]' },
  ]);

  it("lets an admin manage any role", () => {
    expect(canManageRoleWithAuthority(admin, authorityOfRole("ADMIN"))).toBe(true);
    expect(canManageRoleWithAuthority(admin, authorityOfRole("MEMBER"))).toBe(true);
  });

  it("never lets a non-admin manage the ADMIN role", () => {
    expect(canManageRoleWithAuthority(manager, authorityOfRole("ADMIN"))).toBe(false);
  });

  it("allows roles within the caller's own permissions and refuses anything beyond", () => {
    expect(canManageRoleWithAuthority(manager, authorityOfRole("VIEWER"))).toBe(true);
    // MEMBER can manage sprints, which the manager cannot.
    expect(canManageRoleWithAuthority(manager, authorityOfRole("MEMBER"))).toBe(false);
  });

  it("resolves custom roles by name or id, and unknown roles to nothing", () => {
    const roles = [{ id: "r1", name: "QA", permissions: ["VIEW_PROJECT", "ADD_COMMENT"] }];
    expect(authorityOfRole("QA", roles).permissions).toEqual(["VIEW_PROJECT", "ADD_COMMENT"]);
    expect(authorityOfRole("r1", roles).permissions).toEqual(["VIEW_PROJECT", "ADD_COMMENT"]);
    expect(authorityOfRole("Ghost", roles)).toEqual({ isAdmin: false, permissions: [] });
  });
});

describe("instance administration (AUDIT-1)", () => {
  // Runs first: nobody holds the flag yet, as on an install being upgraded.
  it("promotes the original owner on upgrade, never whoever happens to ask", async () => {
    signIn(ids.projectAdmin);
    await expect(requireInstanceAdmin()).rejects.toThrow(/instance administrator/);

    const owner = await prisma.user.findUnique({ where: { id: ids.owner } });
    const asker = await prisma.user.findUnique({ where: { id: ids.projectAdmin } });
    expect(owner?.isInstanceAdmin).toBe(true);
    expect(asker?.isInstanceAdmin).toBe(false);
  });

  it("refuses SSO changes from a project admin who isn't an instance admin", async () => {
    signIn(ids.projectAdmin);
    const res = await updateSsoConfig({ enabled: true, issuerUrl: "https://evil.example" });
    expect(res.success).toBe(false);
    expect(await getSsoConfig()).toBeNull();
  });

  it("refuses letting a project admin grant themselves project creation", async () => {
    signIn(ids.projectAdmin);
    const res = await updateUserProjectPermission(ids.projectAdmin, true);
    expect(res.success).toBe(false);
    const row = await prisma.user.findUnique({ where: { id: ids.projectAdmin } });
    expect(row?.canCreateProjects).toBe(false);
  });

  it("refuses letting a project admin make themselves an instance admin", async () => {
    signIn(ids.projectAdmin);
    const res = await setUserInstanceAdmin(ids.projectAdmin, true);
    expect(res.success).toBe(false);
    expect(await getInstanceUsers()).toEqual([]);
  });

  it("lets the instance admin manage SSO and appoint others", async () => {
    signIn(ids.owner);
    expect((await updateSsoConfig({ providerName: "Okta" })).success).toBe(true);
    expect((await setUserInstanceAdmin(ids.member, true)).success).toBe(true);
    expect((await setUserInstanceAdmin(ids.member, false)).success).toBe(true);
  });

  it("never removes the last instance admin", async () => {
    signIn(ids.owner);
    const res = await setUserInstanceAdmin(ids.owner, false);
    expect(res.success).toBe(false);
    const owner = await prisma.user.findUnique({ where: { id: ids.owner } });
    expect(owner?.isInstanceAdmin).toBe(true);
  });

  it("doesn't show global webhooks to a project admin", async () => {
    await prisma.webhook.create({
      data: { name: "Global Slack", url: "https://hooks.slack.com/services/SECRET", events: "[]" },
    });
    signIn(ids.projectAdmin);
    const hooks = await getProjectWebhooks(ids.project);
    expect(hooks.some((h) => h.url.includes("SECRET"))).toBe(false);

    signIn(ids.owner);
    const ownerHooks = await getProjectWebhooks(ids.project);
    expect(ownerHooks.some((h) => h.url.includes("SECRET"))).toBe(true);
  });
});

describe("managing access can't be used to gain it (AUDIT-2)", () => {
  it("refuses self-promotion to ADMIN", async () => {
    signIn(ids.manager);
    const res = await updateProjectMemberRole(ids.project, ids.manager, "ADMIN");
    expect(res.success).toBe(false);
    expect((await roleOf(ids.manager))?.role).toBe("Team Manager");
  });

  it("refuses adding permissions to a role the caller holds", async () => {
    signIn(ids.manager);
    const res = await updateCustomRole(ids.managerRole, { permissions: ALL_PERMISSIONS });
    expect(res.success).toBe(false);
    const role = await prisma.customRole.findUnique({ where: { id: ids.managerRole } });
    expect(JSON.parse(role!.permissions)).not.toContain("PROJECT_ADMIN");
  });

  it("refuses creating a role more powerful than the caller", async () => {
    signIn(ids.manager);
    const res = await createCustomRole(ids.project, { name: "Super", permissions: ALL_PERMISSIONS });
    expect(res.success).toBe(false);
    expect(await prisma.customRole.count({ where: { name: "Super" } })).toBe(0);
  });

  it("refuses deleting a role with ADMIN as the fallback", async () => {
    signIn(ids.manager);
    const res = await deleteCustomRole(ids.managerRole, "ADMIN");
    expect(res.success).toBe(false);
    expect((await roleOf(ids.manager))?.role).toBe("Team Manager");
  });

  it("refuses a fallback role that doesn't exist", async () => {
    signIn(ids.owner);
    const res = await deleteCustomRole(ids.managerRole, "Nonexistent");
    expect(res.success).toBe(false);
    expect(await prisma.customRole.count({ where: { id: ids.managerRole } })).toBe(1);
  });

  it("refuses demoting or removing someone who outranks the caller", async () => {
    signIn(ids.manager);
    expect((await updateProjectMemberRole(ids.project, ids.projectAdmin, "VIEWER")).success).toBe(false);
    expect((await removeProjectMember(ids.project, ids.projectAdmin)).success).toBe(false);
    expect((await roleOf(ids.projectAdmin))?.role).toBe("ADMIN");
  });

  it("refuses adding a new member as ADMIN", async () => {
    signIn(ids.manager);
    const res = await addProjectMember(ids.project, ids.outsider, "ADMIN");
    expect(res.success).toBe(false);
    expect(await roleOf(ids.outsider)).toBeNull();
  });

  it("still allows managing access within the caller's reach", async () => {
    signIn(ids.manager);
    const res = await addProjectMember(ids.project, ids.outsider, "VIEWER");
    expect(res.success).toBe(true);
    expect((await roleOf(ids.outsider))?.role).toBe("VIEWER");
  });

  it("still lets a project admin assign any role", async () => {
    signIn(ids.projectAdmin);
    const res = await updateProjectMemberRole(ids.project, ids.member, "ADMIN");
    expect(res.success).toBe(true);
    expect((await roleOf(ids.member))?.role).toBe("ADMIN");
  });
});
