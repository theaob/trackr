// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

let pathname = "/projects/APOLLO/backlog";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// Server actions reach for the database; the rail only needs them to exist.
vi.mock("@/lib/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("@/components/auth/PersonalAccessTokensModal", () => ({ default: () => null }));
vi.mock("@/components/auth/AccountSecurityModal", () => ({ default: () => null }));

import Rail from "../Rail";
import { UserProvider } from "@/context/UserContext";
import type { Project } from "@/types";

const me = { id: "u1", name: "Ada Lovelace", email: "ada@example.com", avatarUrl: null, role: "Developer", isInstanceAdmin: false };

const project = (id: string, key: string, name: string, extra: Partial<Project> = {}) =>
  ({ id, key, name, leadId: "someone-else", members: [], allowAnonymousViewers: false, ...extra }) as unknown as Project;

const apollo = project("p1", "APOLLO", "Apollo Cloud Engine", { leadId: "u1" });
const orion = project("p2", "ORION", "Orion Data Platform", { members: [{ userId: "u1", role: "MEMBER" }] } as any);
const publicOnly = project("p3", "PUB", "Public Playground", { allowAnonymousViewers: true });
const stranger = project("p4", "SECRET", "Someone Else's Project");

function renderRail(props: Partial<React.ComponentProps<typeof Rail>> = {}, user: typeof me | null = me) {
  return render(
    <UserProvider sessionUser={user}>
      <Rail
        projects={[apollo, orion, publicOnly, stranger]}
        currentProject={apollo}
        collapsed={false}
        counts={{ openIssues: 4, unread: 2 }}
        {...props}
      />
    </UserProvider>
  );
}

describe("Rail", () => {
  it("lists the projects you're on, not every project you can see", () => {
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Apollo Cloud Engine" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Orion Data Platform" })).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Public Playground" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /Someone Else/ })).toBeNull();
  });

  it("still shows a public project you're looking at", () => {
    renderRail({ currentProject: publicOnly });
    expect(screen.getByRole("link", { name: "Public Playground" })).toBeTruthy();
  });

  it("opens out the current project's pages and marks the one you're on", () => {
    renderRail();
    const pages = screen.getByRole("list", { name: "Apollo Cloud Engine pages" });
    const names = within(pages).getAllByRole("link").map((a) => a.textContent);
    expect(names).toEqual(["Board", "Backlog", "Roadmap", "Issues", "Reports", "Releases", "Settings"]);
    expect(within(pages).getByRole("link", { name: "Backlog" }).getAttribute("aria-current")).toBe("page");
    expect(within(pages).getByRole("link", { name: "Board" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("list", { name: "Orion Data Platform pages" })).toBeNull();
  });

  it("links every page within two clicks: a project, then its page", () => {
    renderRail();
    expect(screen.getByRole("link", { name: "Orion Data Platform" }).getAttribute("href")).toBe("/projects/ORION/board");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/projects/APOLLO/settings");
    expect(screen.getByRole("link", { name: "All projects" }).getAttribute("href")).toBe("/projects");
  });

  it("gives the counts beside Home and Inbox a spoken meaning", () => {
    renderRail();
    expect(screen.getByRole("link", { name: /Home.*4 open issues assigned to you/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Inbox.*2 unread/ })).toBeTruthy();
  });

  it("keeps every link named when collapsed to icons", () => {
    renderRail({ collapsed: true });
    expect(screen.getByRole("link", { name: "Home, 4 open issues" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inbox, 2 unread" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Apollo Cloud Engine: Backlog" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Account: Ada Lovelace" })).toBeTruthy();
  });

  it("shows System settings only to instance administrators", () => {
    const { unmount } = renderRail();
    expect(screen.queryByRole("link", { name: "System settings" })).toBeNull();
    unmount();
    renderRail({}, { ...me, isInstanceAdmin: true });
    expect(screen.getByRole("link", { name: "System settings" })).toBeTruthy();
  });

  it("highlights Home on the Home page", () => {
    pathname = "/home";
    renderRail({ currentProject: null });
    expect(screen.getByRole("link", { name: /^Home/ }).getAttribute("aria-current")).toBe("page");
    pathname = "/projects/APOLLO/backlog";
  });
});
