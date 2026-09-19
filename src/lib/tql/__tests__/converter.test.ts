import { describe, expect, it } from "vitest";
import { basicFiltersToTQL, tqlToBasicFilters } from "../converter";
import { getTQLCompletions } from "../autocomplete";

describe("TQLConverter", () => {
  it("converts basic filters to TQL query string", () => {
    const tql = basicFiltersToTQL({
      projectKey: "APOLLO",
      type: "BUG",
      status: "In Progress",
      priority: "HIGH",
      assigneeId: "UNASSIGNED",
      sortField: "createdAt",
      sortOrder: "desc",
    });

    expect(tql).toContain('project = "APOLLO"');
    expect(tql).toContain('type = "BUG"');
    expect(tql).toContain('status = "In Progress"');
    expect(tql).toContain('priority = "HIGH"');
    expect(tql).toContain("assignee is EMPTY");
    expect(tql).toContain("ORDER BY createdAt DESC");
  });

  it("converts preset MY_OPEN to TQL", () => {
    const tql = basicFiltersToTQL({
      preset: "MY_OPEN",
    });
    expect(tql).toBe("assignee = currentUser() AND statusCategory != Done");
  });

  it("roundtrips simple TQL back to basic filter state", () => {
    const query = 'project = "APOLLO" AND type = "BUG" AND status = "In Progress"';
    const res = tqlToBasicFilters(query);
    expect(res.convertible).toBe(true);
    if (res.convertible) {
      expect(res.state.projectKey).toBe("APOLLO");
      expect(res.state.type).toBe("BUG");
      expect(res.state.status).toBe("In Progress");
    }
  });

  it("detects when a query cannot be converted to basic filters", () => {
    const query = 'project = "APOLLO" OR priority = "HIGH"';
    const res = tqlToBasicFilters(query);
    expect(res.convertible).toBe(false);
  });
});

describe("TQLAutocomplete", () => {
  it("suggests fields at the start of a query", () => {
    const completions = getTQLCompletions("", 0);
    expect(completions.some((c) => c.label === "project")).toBe(true);
    expect(completions.some((c) => c.label === "status")).toBe(true);
    expect(completions.some((c) => c.label === "assignee")).toBe(true);
  });

  it("suggests operators after a field name", () => {
    const completions = getTQLCompletions("status ", 7);
    expect(completions.some((c) => c.label === "=")).toBe(true);
    expect(completions.some((c) => c.label === "!=")).toBe(true);
    expect(completions.some((c) => c.label === "in")).toBe(true);
  });

  it("suggests currentUser() and users after assignee =", () => {
    const completions = getTQLCompletions("assignee = ", 11, {
      users: [{ id: "u1", name: "Alice", email: "alice@example.com" }],
    });
    expect(completions.some((c) => c.label === "currentUser()")).toBe(true);
    expect(completions.some((c) => c.label === '"Alice"')).toBe(true);
  });

  it("suggests boolean operators after a completed predicate", () => {
    const completions = getTQLCompletions('project = "APOLLO" ', 19);
    expect(completions.some((c) => c.label === "AND")).toBe(true);
    expect(completions.some((c) => c.label === "OR")).toBe(true);
    expect(completions.some((c) => c.label === "ORDER BY")).toBe(true);
  });
});
