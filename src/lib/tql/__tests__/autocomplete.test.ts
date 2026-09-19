import { describe, it, expect } from "vitest";
import { getTQLCompletions, TQLAutocompleteContext } from "../autocomplete";

describe("TQL Autocomplete Engine", () => {
  const context: TQLAutocompleteContext = {
    projects: [
      { key: "PROJ", name: "Project Alpha" },
      { key: "BETA", name: "Beta App" },
    ],
    statuses: ["To Do", "In Progress", "Done"],
    users: [
      { id: "u1", name: "Alice Smith" },
      { id: "u2", name: "Bob Jones" },
    ],
    sprints: ["Sprint 1", "Sprint 2"],
    versions: ["v1.0.0", "v1.1.0"],
    labels: ["frontend", "bug"],
  };

  it("suggests fields at empty query or beginning of expression", () => {
    const completions = getTQLCompletions("", 0, context);
    expect(completions.length).toBeGreaterThan(0);
    const fieldLabels = completions.map((c) => c.label);
    expect(fieldLabels).toContain("project");
    expect(fieldLabels).toContain("status");
    expect(fieldLabels).toContain("assignee");
    expect(fieldLabels).toContain("priority");
  });

  it("suggests operators after a field name", () => {
    const query = "status ";
    const completions = getTQLCompletions(query, query.length, context);
    const opLabels = completions.map((c) => c.label);
    expect(opLabels).toContain("=");
    expect(opLabels).toContain("!=");
    expect(opLabels).toContain("in");
    expect(opLabels).toContain("is EMPTY");
  });

  it("suggests status values after 'status ='", () => {
    const query = "status = ";
    const completions = getTQLCompletions(query, query.length, context);
    const valLabels = completions.map((c) => c.label);
    expect(valLabels).toContain('"To Do"');
    expect(valLabels).toContain('"In Progress"');
    expect(valLabels).toContain('"Done"');
  });

  it("suggests currentUser() and users after 'assignee ='", () => {
    const query = "assignee = ";
    const completions = getTQLCompletions(query, query.length, context);
    const valLabels = completions.map((c) => c.label);
    expect(valLabels).toContain("currentUser()");
    expect(valLabels).toContain('"Alice Smith"');
    expect(valLabels).toContain('"Bob Jones"');
  });

  it("suggests boolean conjunctions and ORDER BY after complete predicate", () => {
    const query = 'status = "Done" ';
    const completions = getTQLCompletions(query, query.length, context);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain("AND");
    expect(labels).toContain("OR");
    expect(labels).toContain("ORDER BY");
  });

  it("suggests sort fields after 'ORDER BY '", () => {
    const query = "ORDER BY ";
    const completions = getTQLCompletions(query, query.length, context);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain("created");
    expect(labels).toContain("updated");
    expect(labels).toContain("priority");
  });

  it("suggests ASC and DESC after 'ORDER BY priority '", () => {
    const query = "ORDER BY priority ";
    const completions = getTQLCompletions(query, query.length, context);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain("ASC");
    expect(labels).toContain("DESC");
  });
});
