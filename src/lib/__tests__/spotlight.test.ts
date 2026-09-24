import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The ranking rules on their own, then the real server search against a
// throwaway database, to check it only ever returns issues the caller can see.
const dbFile = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/tamam-spotlight-${process.pid}-${Date.now()}.db`;
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
import { getSpotlightProjects, searchSpotlightIssues, searchSpotlightPeople } from "@/lib/actions/search";
import {
  buildSpotlightDestinations,
  filterablePage,
  isSpotlightShortcut,
  issueKeyForQuery,
  projectKeyFromPath,
  rankDestinations,
  personMatches,
  rankIssueMatches,
  spotlightIssueHref,
  spotlightPersonHref,
} from "@/lib/spotlight";

const PROJECTS = [
  { id: "1", key: "APOLLO", name: "Apollo Cloud Engine" },
  { id: "2", key: "ORION", name: "Orion Data Platform" },
];

describe("destinations", () => {
  const all = buildSpotlightDestinations({
    projects: PROJECTS,
    currentProjectKey: "orion",
    signedIn: true,
    instanceAdmin: false,
  });

  it("lists each project and its pages, the current project first", () => {
    expect(all[0]).toMatchObject({ kind: "project", projectKey: "ORION", current: true });
    expect(all.filter((d) => d.kind === "page" && d.projectKey === "APOLLO")).toHaveLength(7);
    expect(all.find((d) => d.id === "page:APOLLO:backlog")?.href).toBe("/projects/APOLLO/backlog");
    expect(all.some((d) => d.pageId === "projects")).toBe(true);
  });

  it("leaves out pages the caller can't open", () => {
    const visitor = buildSpotlightDestinations({ projects: PROJECTS, signedIn: false, instanceAdmin: false });
    expect(visitor.some((d) => d.pageId === "settings")).toBe(false);
    expect(visitor.some((d) => d.pageId === "system-settings")).toBe(false);
    const admin = buildSpotlightDestinations({ projects: PROJECTS, signedIn: true, instanceAdmin: true });
    expect(admin.find((d) => d.pageId === "system-settings")?.href).toBe("/settings");
  });

  it("ranks the current project's page first and matches every word", () => {
    expect(rankDestinations("backlog", all)[0].id).toBe("page:ORION:backlog");
    expect(rankDestinations("apollo backlog", all).map((d) => d.id)).toEqual(["page:APOLLO:backlog"]);
    expect(rankDestinations("burndown", all)[0].title).toBe("Reports");
    expect(rankDestinations("apollo", all)[0]).toMatchObject({ kind: "project", projectKey: "APOLLO" });
    expect(rankDestinations("nothing like this", all)).toEqual([]);
  });

  it("returns everything in order for an empty query, up to the limit", () => {
    expect(rankDestinations("  ", all, 3)).toEqual(all.slice(0, 3));
  });
});

describe("issue ranking", () => {
  const issue = (key: string, title: string, project = key.split("-")[0]) => ({ key, title, project: { key: project } });

  it("reads issue keys out of a query", () => {
    expect(issueKeyForQuery("apollo-3")).toBe("APOLLO-3");
    expect(issueKeyForQuery("12", "orion")).toBe("ORION-12");
    expect(issueKeyForQuery("12")).toBeNull();
    expect(issueKeyForQuery("fix login")).toBeNull();
  });

  it("puts the exact key first, then prefix and title matches, then the current project", () => {
    const issues = [
      issue("APOLLO-30", "Something else"),
      issue("ORION-1", "Socket timeouts"),
      issue("APOLLO-3", "Configure WebSocket fallback"),
      issue("APOLLO-4", "socket pool"),
    ];
    expect(rankIssueMatches("apollo-3", issues).map((i) => i.key)[0]).toBe("APOLLO-3");
    expect(rankIssueMatches("3", issues, "APOLLO").map((i) => i.key)[0]).toBe("APOLLO-3");
    expect(rankIssueMatches("socket", issues, "APOLLO").map((i) => i.key)).toEqual([
      "APOLLO-4",
      "ORION-1",
      "APOLLO-3",
      "APOLLO-30",
    ]);
  });
});

describe("helpers", () => {
  it("recognises ⌘K and Ctrl+K only", () => {
    const e = { key: "k", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
    expect(isSpotlightShortcut({ ...e, metaKey: true })).toBe(true);
    expect(isSpotlightShortcut({ ...e, ctrlKey: true, key: "K" })).toBe(true);
    expect(isSpotlightShortcut(e)).toBe(false);
    expect(isSpotlightShortcut({ ...e, metaKey: true, shiftKey: true })).toBe(false);
    expect(isSpotlightShortcut({ ...e, ctrlKey: true, key: "j" })).toBe(false);
  });

  it("reads the project and page from a path", () => {
    expect(projectKeyFromPath("/projects/apollo/board")).toBe("APOLLO");
    expect(projectKeyFromPath("/projects")).toBeNull();
    expect(filterablePage("/projects/APOLLO/backlog")).toBe("backlog");
    expect(filterablePage("/projects/APOLLO/reports")).toBeNull();
    expect(spotlightIssueHref("APOLLO", "APOLLO-3")).toBe("/projects/APOLLO/issues/APOLLO-3");
  });
});

describe("people", () => {
  it("matches the start of any word of the name", () => {
    expect(personMatches("Grace Hopper", "hop")).toBe(true);
    expect(personMatches("Grace Hopper", "g h")).toBe(true);
    expect(personMatches("Grace Hopper", "race")).toBe(false);
  });

  it("links to the issues assigned to them", () => {
    const href = spotlightPersonHref("APOLLO", "u42");
    expect(href.startsWith("/projects/APOLLO/issues?tql=")).toBe(true);
    expect(decodeURIComponent(href.split("tql=")[1])).toBe('project = "APOLLO" AND assignee = "u42" ORDER BY updated DESC');
  });
});

describe("server search", () => {
  let memberId: string;
  let outsiderId: string;

  beforeAll(async () => {
    execFileSync(
      process.execPath,
      [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"],
      { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" }
    );
    const member = await prisma.user.create({ data: { name: "Member", email: "m@x.dev" } });
    const outsider = await prisma.user.create({ data: { name: "Outsider", email: "o@x.dev" } });
    memberId = member.id;
    outsiderId = outsider.id;

    const secret = await prisma.project.create({ data: { name: "Secret Plans", key: "SEC", leadId: member.id } });
    const open = await prisma.project.create({
      data: { name: "Open Source", key: "OSS", leadId: member.id, allowAnonymousViewers: true },
    });
    await prisma.projectMember.create({ data: { projectId: secret.id, userId: member.id, role: "ADMIN" } });
    await prisma.issue.createMany({
      data: [
        { key: "SEC-1", title: "Configure WebSocket fallback", status: "TODO", projectId: secret.id, reporterId: member.id },
        { key: "SEC-2", title: "Rotate signing keys", status: "TODO", projectId: secret.id, reporterId: member.id },
        { key: "OSS-1", title: "Websocket docs", status: "DONE", projectId: open.id, reporterId: member.id },
        { key: "OSS-2", title: "100% coverage_goal", status: "TODO", projectId: open.id, reporterId: member.id },
        // Would match "100%" and "e_g" if those were wildcards.
        { key: "OSS-3", title: "Support 100 users on eXgress", status: "TODO", projectId: open.id, reporterId: member.id },
      ],
    });
    await prisma.workflowStatus.create({ data: { projectId: open.id, name: "DONE", category: "DONE", color: "#123456" } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
  });

  it("finds issues by any case and every word, in projects the caller belongs to", async () => {
    session.userId = memberId;
    const keys = (await searchSpotlightIssues("WEBSOCKET")).map((i) => i.key).sort();
    expect(keys).toEqual(["OSS-1", "SEC-1"]);
    expect((await searchSpotlightIssues("websocket fallback")).map((i) => i.key)).toEqual(["SEC-1"]);
    expect((await searchSpotlightIssues("2", "SEC"))[0].key).toBe("SEC-2");
  });

  it("returns project names and status colors", async () => {
    session.userId = memberId;
    const [docs] = await searchSpotlightIssues("docs");
    expect(docs).toMatchObject({ key: "OSS-1", projectKey: "OSS", projectName: "Open Source", statusColor: "#123456" });
  });

  it("never shows private projects to outsiders or signed-out visitors", async () => {
    for (const who of [outsiderId, null]) {
      session.userId = who;
      expect((await searchSpotlightIssues("websocket")).map((i) => i.key)).toEqual(["OSS-1"]);
      expect(await searchSpotlightIssues("SEC-1")).toEqual([]);
      expect((await getSpotlightProjects()).map((p) => p.key)).toEqual(["OSS"]);
    }
    session.userId = memberId;
    expect((await getSpotlightProjects()).map((p) => p.key)).toEqual(["OSS", "SEC"]);
  });

  it("finds people on the caller's project teams, by name only", async () => {
    const secret = await prisma.project.findUniqueOrThrow({ where: { key: "SEC" } });
    const tess = await prisma.user.create({ data: { name: "Tess Teammate", email: "tess@x.dev" } });
    await prisma.projectMember.create({ data: { projectId: secret.id, userId: tess.id, role: "MEMBER" } });

    session.userId = memberId;
    expect((await searchSpotlightPeople("tes")).map((p) => p.name)).toEqual(["Tess Teammate"]);
    expect(await searchSpotlightPeople("tess@x.dev")).toEqual([]);
    // Outsiders share no team, and signed-out visitors find nobody.
    for (const who of [outsiderId, null]) {
      session.userId = who;
      expect(await searchSpotlightPeople("tess")).toEqual([]);
    }
  });

  it("treats % and _ as plain characters and ignores empty queries", async () => {
    session.userId = memberId;
    expect((await searchSpotlightIssues("100%")).map((i) => i.key)).toEqual(["OSS-2"]);
    expect((await searchSpotlightIssues("e_g")).map((i) => i.key)).toEqual(["OSS-2"]);
    expect(await searchSpotlightIssues("s%s")).toEqual([]);
    expect(await searchSpotlightIssues("   ")).toEqual([]);
  });
});
