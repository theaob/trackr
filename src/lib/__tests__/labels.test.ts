import { describe, expect, it } from "vitest";
import { isValidLabelName, normalizeLabelName } from "@/lib/labels";

describe("normalizeLabelName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeLabelName("  backend  ")).toBe("backend");
  });

  it("preserves internal casing and characters", () => {
    expect(normalizeLabelName("Needs-QA_v2")).toBe("Needs-QA_v2");
  });
});

describe("isValidLabelName", () => {
  it("accepts a plain word", () => {
    expect(isValidLabelName("backend")).toBe(true);
  });

  it("accepts hyphens and underscores", () => {
    expect(isValidLabelName("needs-review")).toBe(true);
    expect(isValidLabelName("tech_debt")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidLabelName("")).toBe(false);
  });

  it("rejects a name containing whitespace", () => {
    expect(isValidLabelName("needs review")).toBe(false);
    expect(isValidLabelName("tab\tseparated")).toBe(false);
  });
});
