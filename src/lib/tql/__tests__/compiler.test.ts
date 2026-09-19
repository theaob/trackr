import { describe, expect, it } from "vitest";
import { TQLParser } from "../parser";
import { TQLCompiler } from "../compiler";

describe("TQLCompiler", () => {
  it("compiles project equality with security boundary", () => {
    const parseRes = TQLParser.parse('project = "APOLLO"');
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      const compiler = new TQLCompiler({ accessibleProjectIds: ["proj-1", "proj-2"] });
      const compiled = compiler.compile(parseRes.query);

      expect(compiled.where.projectId).toEqual({ in: ["proj-1", "proj-2"] });
      expect(compiled.where.AND[0].project).toBeDefined();
      expect(compiled.where.AND[0].project.OR).toEqual([
        { key: "APOLLO" },
        { name: "APOLLO" },
      ]);
    }
  });

  it("resolves currentUser() to current user id", () => {
    const parseRes = TQLParser.parse("assignee = currentUser()");
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      const compiler = new TQLCompiler({ currentUserId: "user-123" });
      const compiled = compiler.compile(parseRes.query);
      expect(compiled.where.assigneeId).toBe("user-123");
    }
  });

  it("handles assignee is EMPTY and is NOT EMPTY", () => {
    const emptyRes = TQLParser.parse("assignee is EMPTY");
    if (emptyRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(emptyRes.query);
      expect(compiled.where.assigneeId).toBeNull();
    }

    const notEmptyRes = TQLParser.parse("assignee IS NOT EMPTY");
    if (notEmptyRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(notEmptyRes.query);
      expect(compiled.where.assigneeId).toEqual({ not: null });
    }
  });

  it("compiles priority hierarchical comparisons", () => {
    const parseRes = TQLParser.parse("priority >= High");
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(parseRes.query);
      expect(compiled.where.priority).toEqual({
        in: ["HIGH", "HIGHEST"],
      });
    }

    const lowRes = TQLParser.parse("priority <= Low");
    if (lowRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(lowRes.query);
      expect(compiled.where.priority).toEqual({
        in: ["LOWEST", "LOW"],
      });
    }
  });

  it("compiles openSprints() function", () => {
    const parseRes = TQLParser.parse("sprint in openSprints()");
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      const compiler = new TQLCompiler({ activeSprintIds: ["sprint-1", "sprint-2"] });
      const compiled = compiler.compile(parseRes.query);
      expect(compiled.where.sprintId).toEqual({
        in: ["sprint-1", "sprint-2"],
      });
    }
  });

  it("compiles relative date comparisons (-7d)", () => {
    const parseRes = TQLParser.parse("created >= -7d");
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(parseRes.query);
      expect(compiled.where.createdAt.gte).toBeInstanceOf(Date);
      const diffMs = Date.now() - compiled.where.createdAt.gte.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(days).toBe(7);
    }
  });

  it("compiles text search queries (~ and text)", () => {
    const summaryRes = TQLParser.parse('summary ~ "security leak"');
    if (summaryRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(summaryRes.query);
      expect(compiled.where.title).toEqual({ contains: "security leak" });
    }

    const textRes = TQLParser.parse('text ~ "crash"');
    if (textRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(textRes.query);
      expect(compiled.where.OR).toBeDefined();
      expect(compiled.where.OR.length).toBe(3);
    }
  });

  it("compiles labels and components relations", () => {
    const labelRes = TQLParser.parse("labels in (frontend, mobile)");
    if (labelRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(labelRes.query);
      expect(compiled.where.labels.some.label.name).toEqual({
        in: ["frontend", "mobile"],
      });
    }
  });

  it("compiles ORDER BY clauses to Prisma orderings", () => {
    const orderRes = TQLParser.parse("project = APOLLO ORDER BY priority DESC, created ASC");
    expect(orderRes.success).toBe(true);
    if (orderRes.success) {
      const compiler = new TQLCompiler();
      const compiled = compiler.compile(orderRes.query);
      expect(compiled.orderBy).toEqual([
        { priority: "desc" },
        { createdAt: "asc" },
      ]);
    }
  });
});
