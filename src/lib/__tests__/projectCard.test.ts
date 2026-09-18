import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/projects/CreateProjectModal", () => ({
  default: () => null,
}));

import ProjectsDirectoryView from "@/components/projects/ProjectsDirectoryView";
import { UserProvider } from "@/context/UserContext";
import { User } from "@/types";

const mockUser: User = {
  id: "user-1",
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
  avatarUrl: null,
};

const mockProjects = [
  {
    id: "proj-1",
    name: "Scrum Alpha",
    key: "SCRUM",
    description: "A scrum project",
    lead: mockUser,
    leadId: mockUser.id,
    members: [{ userId: mockUser.id, role: "ADMIN" }],
    totalIssues: 10,
    openIssues: 5,
    activeSprint: "Sprint 3",
    boardType: "SCRUM",
  },
  {
    id: "proj-2",
    name: "Kanban Beta",
    key: "KANBAN",
    description: "A kanban project",
    lead: mockUser,
    leadId: mockUser.id,
    members: [{ userId: mockUser.id, role: "ADMIN" }],
    totalIssues: 8,
    openIssues: 2,
    activeSprint: null,
    boardType: "KANBAN",
  },
];

describe("ProjectsDirectoryView Project Cards", () => {
  it("displays project type instead of active sprint name", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UserProvider,
        { sessionUser: mockUser, initialUsers: [mockUser] },
        React.createElement(ProjectsDirectoryView, {
          initialProjects: mockProjects,
          users: [mockUser],
        })
      )
    );

    // It should display Type: Scrum for Scrum Alpha
    expect(html).toContain("Scrum Alpha");
    expect(html).toContain("Scrum");

    // It should display Type: Kanban for Kanban Beta
    expect(html).toContain("Kanban Beta");
    expect(html).toContain("Kanban");

    // It should display "Type:" label
    expect(html).toContain("Type:");

    // It should NOT display "Sprint:" or active sprint name in the card stats
    expect(html).not.toContain("Sprint 3");
    expect(html).not.toContain("Sprint:");
  });
});
