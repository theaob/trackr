import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sidebar from "@/components/layout/Sidebar";
import { Project } from "@/types";

// Mock usePathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/TEST/board",
}));

// Mock UserContext
vi.mock("@/context/UserContext", () => ({
  useCurrentUser: () => ({
    currentUser: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    },
  }),
}));

describe("Sidebar", () => {
  const mockProject: Project = {
    id: "p1",
    name: "DENEME",
    key: "DENEME",
    boardType: "SCRUM",
    description: null,
    leadId: null,
  };

  it("does not render project information or software project banner in the sidebar", () => {
    const html = renderToStaticMarkup(React.createElement(Sidebar, { project: mockProject }));
    expect(html).not.toContain("Software project");
    expect(html).not.toContain("Project Key:");
    expect(html).not.toContain("animate-ping");
  });

  it("renders navigation items under planning section", () => {
    const html = renderToStaticMarkup(React.createElement(Sidebar, { project: mockProject }));
    expect(html).toContain("Planning");
    expect(html).toContain("Active Board");
    expect(html).toContain("Backlog");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Issues");
    expect(html).toContain("Reports");
    expect(html).toContain("Releases");
    expect(html).toContain("Project Settings");
  });
});
