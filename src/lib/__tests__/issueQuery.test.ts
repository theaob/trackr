import { describe, expect, it } from "vitest";
import {
  BUILT_IN_VIEWS,
  chipToTQL,
  describeExtra,
  emptyFilters,
  filtersToTQL,
  matchesView,
  ME,
  NONE,
  normalizeColumns,
  OPEN_SPRINTS,
  queryForView,
  queryToTQL,
  tqlToQuery,
  viewQuery,
  DEFAULT_COLUMNS,
  type IssueQuery,
} from "@/lib/issueQuery";
import { TQLParser } from "@/lib/tql/parser";

const parse = (tql: string) => {
  const r = tqlToQuery(tql);
  if (!r.ok) throw new Error(r.error);
  return r.query;
};

describe("chips to TQL", () => {
  it("writes one value as =, several as in, and specials as OR", () => {
    expect(chipToTQL("type", ["BUG"])).toBe('type = "BUG"');
    expect(chipToTQL("priority", ["HIGH", "HIGHEST"])).toBe('priority in ("HIGH", "HIGHEST")');
    expect(chipToTQL("assignee", [ME, NONE])).toBe("(assignee = currentUser() OR assignee is EMPTY)");
    expect(chipToTQL("sprint", [OPEN_SPRINTS])).toBe("sprint in openSprints()");
    expect(chipToTQL("version", ["1.0"])).toBe('fixVersion = "1.0"');
    expect(chipToTQL("label", [])).toBeNull();
  });

  it("puts the project first and every chip after, all AND-ed", () => {
    const f = { ...emptyFilters("APOLLO"), status: ["TODO"], label: ["ui", 'say "hi"'], text: "login" };
    expect(filtersToTQL(f)).toBe('project = "APOLLO" AND status = "TODO" AND labels in ("ui", "say \\"hi\\"") AND text ~ "login"');
  });

  it("always produces TQL the server's parser accepts", () => {
    const f = {
      ...emptyFilters("APOLLO"),
      type: ["BUG", "TASK"],
      assignee: ["u1", ME, NONE],
      reporter: [ME],
      sprint: ["Sprint 2", NONE, OPEN_SPRINTS],
      version: [NONE],
      extra: ["statusCategory != Done", "updated >= -7d OR created >= -1d"],
    };
    const tql = queryToTQL({ filters: f, sort: { field: "updated", direction: "DESC" } });
    expect(TQLParser.parse(tql).success).toBe(true);
  });
});

describe("TQL to chips", () => {
  it("reads the project, chips, text and sort", () => {
    const q = parse('project = apollo AND type in (bug, task) AND assignee = currentUser() AND text ~ "crash" ORDER BY updated ASC');
    expect(q.filters.projectKey).toBe("APOLLO");
    expect(q.filters.type).toEqual(["BUG", "TASK"]);
    expect(q.filters.assignee).toEqual([ME]);
    expect(q.filters.text).toBe("crash");
    expect(q.filters.extra).toEqual([]);
    expect(q.sort).toEqual({ field: "updated", direction: "ASC" });
  });

  it("merges an OR of the same field into one chip", () => {
    expect(parse("(assignee = currentUser() OR assignee is EMPTY)").filters.assignee).toEqual([ME, NONE]);
    expect(parse("sprint in openSprints()").filters.sprint).toEqual([OPEN_SPRINTS]);
  });

  it("keeps what chips can't show as TQL of its own", () => {
    const q = parse('statusCategory != Done AND (type = BUG OR priority = HIGH) AND status = "TODO" AND status = "DONE"');
    expect(q.filters.status).toEqual(["TODO"]);
    expect(q.filters.extra).toEqual(['statusCategory != "Done"', '(type = "BUG" OR priority = "HIGH")', 'status = "DONE"']);
    expect(describeExtra(q.filters.extra[0])).toBe("Not done");
  });

  it("round-trips: chips -> TQL -> chips gives the same query", () => {
    const original: IssueQuery = {
      filters: {
        ...emptyFilters("ORION"),
        status: ["IN_PROGRESS"],
        assignee: ["u1", NONE],
        sprint: ["Sprint 9"],
        label: ["backend"],
        text: "timeout",
        extra: ['statusCategory != "Done"', "updated >= -7d"],
      },
      sort: { field: "duedate", direction: "ASC" },
    };
    const again = parse(queryToTQL(original));
    expect(queryToTQL(again)).toBe(queryToTQL(original));
    expect(again.filters.assignee).toEqual(["u1", NONE]);
  });

  it("reports a syntax error instead of guessing", () => {
    expect(tqlToQuery("status = ").ok).toBe(false);
  });
});

describe("views", () => {
  it("every built-in view parses and keeps its meaning", () => {
    for (const view of BUILT_IN_VIEWS) {
      expect(tqlToQuery(view.tql).ok).toBe(true);
    }
    const mine = viewQuery(BUILT_IN_VIEWS.find((v) => v.id === "preset-my-open")!, "APOLLO");
    expect(mine.filters.projectKey).toBe("APOLLO");
    expect(mine.filters.assignee).toEqual([ME]);
    expect(mine.filters.extra).toEqual(['statusCategory != "Done"']);
    expect(viewQuery(BUILT_IN_VIEWS.find((v) => v.id === "preset-high")!, null).filters.priority).toEqual(["HIGHEST", "HIGH"]);
  });

  it("stores views without the project, so they work in any project", () => {
    const q = viewQuery(BUILT_IN_VIEWS[1], "APOLLO");
    expect(queryForView(q)).not.toContain("project");
  });

  it("knows when the page has drifted from the view", () => {
    const view = BUILT_IN_VIEWS[0];
    const q = viewQuery(view, "APOLLO");
    expect(matchesView(view, q, DEFAULT_COLUMNS)).toBe(true);
    expect(matchesView(view, { ...q, filters: { ...q.filters, type: ["BUG"] } }, DEFAULT_COLUMNS)).toBe(false);
    expect(matchesView(view, q, ["key", "title"])).toBe(false);
  });

  it("normalizes columns to the standard order, always with key and summary", () => {
    expect(normalizeColumns(["updated", "status", "bogus"])).toEqual(["key", "title", "status", "updated"]);
    expect(normalizeColumns([])).toEqual(normalizeColumns(DEFAULT_COLUMNS));
  });
});
