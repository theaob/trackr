import { describe, expect, it } from "vitest";
import { isValidComponentName, normalizeComponentName } from "@/lib/components";

describe("normalizeComponentName", () => {
  it("trims surrounding whitespace only", () => {
    expect(normalizeComponentName("  Backend API  ")).toBe("Backend API");
  });

  it("keeps internal spaces, unlike a label", () => {
    expect(normalizeComponentName("Mobile App")).toBe("Mobile App");
  });
});

describe("isValidComponentName", () => {
  it("accepts an ordinary name, spaces included", () => {
    expect(isValidComponentName("Backend API")).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(isValidComponentName("")).toBe(false);
  });

  it("rejects a name over the length limit", () => {
    expect(isValidComponentName("a".repeat(100))).toBe(true);
    expect(isValidComponentName("a".repeat(101))).toBe(false);
  });
});
