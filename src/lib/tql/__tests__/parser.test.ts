import { describe, expect, it } from "vitest";
import { TQLParser } from "../parser";
import { TQLBinaryNode, TQLPredicateNode } from "../ast";

describe("TQLParser", () => {
  it("parses empty query", () => {
    const res = TQLParser.parse("");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.query.where).toBeUndefined();
      expect(res.query.orderBy).toEqual([]);
    }
  });

  it("parses simple equality predicate", () => {
    const res = TQLParser.parse('project = "APOLLO"');
    expect(res.success).toBe(true);
    if (res.success) {
      const pred = res.query.where as TQLPredicateNode;
      expect(pred.type).toBe("PREDICATE");
      expect(pred.field).toBe("project");
      expect(pred.operator).toBe("=");
      expect(pred.value).toEqual({ type: "STRING", value: "APOLLO" });
    }
  });

  it("parses unquoted identifiers as string values", () => {
    const res = TQLParser.parse("priority = High");
    expect(res.success).toBe(true);
    if (res.success) {
      const pred = res.query.where as TQLPredicateNode;
      expect(pred.field).toBe("priority");
      expect(pred.operator).toBe("=");
      expect(pred.value).toEqual({ type: "STRING", value: "High" });
    }
  });

  it("parses numeric values and comparison operators", () => {
    const res = TQLParser.parse("storyPoints >= 5");
    expect(res.success).toBe(true);
    if (res.success) {
      const pred = res.query.where as TQLPredicateNode;
      expect(pred.field).toBe("storyPoints");
      expect(pred.operator).toBe(">=");
      expect(pred.value).toEqual({ type: "NUMBER", value: 5 });
    }
  });

  it("parses IN and NOT IN operators", () => {
    const inRes = TQLParser.parse("type in (Bug, Story, Task)");
    expect(inRes.success).toBe(true);
    if (inRes.success) {
      const pred = inRes.query.where as TQLPredicateNode;
      expect(pred.operator).toBe("IN");
      expect(pred.value).toEqual({
        type: "LIST",
        values: [
          { type: "STRING", value: "Bug" },
          { type: "STRING", value: "Story" },
          { type: "STRING", value: "Task" },
        ],
      });
    }

    const notInRes = TQLParser.parse("status NOT IN (Done, Closed)");
    expect(notInRes.success).toBe(true);
    if (notInRes.success) {
      const pred = notInRes.query.where as TQLPredicateNode;
      expect(pred.operator).toBe("NOT IN");
      expect(pred.value).toEqual({
        type: "LIST",
        values: [
          { type: "STRING", value: "Done" },
          { type: "STRING", value: "Closed" },
        ],
      });
    }
  });

  it("parses IS EMPTY and IS NOT EMPTY / NULL", () => {
    const emptyRes = TQLParser.parse("assignee is EMPTY");
    expect(emptyRes.success).toBe(true);
    if (emptyRes.success) {
      const pred = emptyRes.query.where as TQLPredicateNode;
      expect(pred.operator).toBe("IS EMPTY");
      expect(pred.value).toEqual({ type: "EMPTY" });
    }

    const notEmptyRes = TQLParser.parse("dueDate IS NOT NULL");
    expect(notEmptyRes.success).toBe(true);
    if (notEmptyRes.success) {
      const pred = notEmptyRes.query.where as TQLPredicateNode;
      expect(pred.operator).toBe("IS NOT EMPTY");
      expect(pred.value).toEqual({ type: "EMPTY" });
    }
  });

  it("parses dynamic functions like currentUser()", () => {
    const res = TQLParser.parse("assignee = currentUser()");
    expect(res.success).toBe(true);
    if (res.success) {
      const pred = res.query.where as TQLPredicateNode;
      expect(pred.value).toEqual({
        type: "FUNCTION",
        name: "currentUser",
        args: [],
      });
    }
  });

  it("parses AND / OR with proper operator precedence and parentheses", () => {
    // A AND B OR C should be parsed as (A AND B) OR C
    const res1 = TQLParser.parse("project = APOLLO AND status = Open OR priority = High");
    expect(res1.success).toBe(true);
    if (res1.success) {
      const root = res1.query.where as TQLBinaryNode;
      expect(root.type).toBe("OR");
      expect(root.left.type).toBe("AND");
      expect(root.right.type).toBe("PREDICATE");
    }

    // With explicit grouping: A AND (B OR C)
    const res2 = TQLParser.parse("project = APOLLO AND (status = Open OR priority = High)");
    expect(res2.success).toBe(true);
    if (res2.success) {
      const root = res2.query.where as TQLBinaryNode;
      expect(root.type).toBe("AND");
      expect(root.right.type).toBe("OR");
    }
  });

  it("parses text search operator ~ and !~", () => {
    const res = TQLParser.parse('summary ~ "security bug"');
    expect(res.success).toBe(true);
    if (res.success) {
      const pred = res.query.where as TQLPredicateNode;
      expect(pred.operator).toBe("~");
      expect(pred.value).toEqual({ type: "STRING", value: "security bug" });
    }
  });

  it("parses ORDER BY clauses", () => {
    const res = TQLParser.parse("ORDER BY created DESC, priority ASC");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.query.where).toBeUndefined();
      expect(res.query.orderBy).toEqual([
        { field: "created", direction: "DESC" },
        { field: "priority", direction: "ASC" },
      ]);
    }

    const queryWithOrder = TQLParser.parse("project = APOLLO ORDER BY dueDate DESC");
    expect(queryWithOrder.success).toBe(true);
    if (queryWithOrder.success) {
      expect(queryWithOrder.query.where).toBeDefined();
      expect(queryWithOrder.query.orderBy).toEqual([
        { field: "dueDate", direction: "DESC" },
      ]);
    }
  });

  it("reports precise syntax errors for invalid input", () => {
    const missingValue = TQLParser.parse("status =");
    expect(missingValue.success).toBe(false);
    if (!missingValue.success) {
      expect(missingValue.error.message).toContain("Expected a value");
    }

    const unclosedParen = TQLParser.parse("(status = Done");
    expect(unclosedParen.success).toBe(false);
    if (!unclosedParen.success) {
      expect(unclosedParen.error.message).toContain("Expected ')'");
    }

    const missingOrderBy = TQLParser.parse("ORDER created DESC");
    expect(missingOrderBy.success).toBe(false);
    if (!missingOrderBy.success) {
      expect(missingOrderBy.error.message).toContain("Expected 'BY' after 'ORDER'");
    }
  });
});
