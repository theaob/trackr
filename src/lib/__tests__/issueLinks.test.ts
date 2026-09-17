import { describe, expect, it } from "vitest";
import { describeIssueLink, isSymmetricLinkType } from "@/lib/issueLinks";

describe("describeIssueLink", () => {
  it("labels a directional type differently on each side", () => {
    expect(describeIssueLink("BLOCKS", "outward")).toBe("blocks");
    expect(describeIssueLink("BLOCKS", "inward")).toBe("is blocked by");
  });

  it("labels DUPLICATES with its own inverse", () => {
    expect(describeIssueLink("DUPLICATES", "outward")).toBe("duplicates");
    expect(describeIssueLink("DUPLICATES", "inward")).toBe("is duplicated by");
  });

  it("labels a symmetric type the same on both sides", () => {
    expect(describeIssueLink("RELATES_TO", "outward")).toBe("relates to");
    expect(describeIssueLink("RELATES_TO", "inward")).toBe("relates to");
  });

  it("falls back to the raw type for anything unrecognized", () => {
    expect(describeIssueLink("MADE_UP", "outward")).toBe("MADE_UP");
  });
});

describe("isSymmetricLinkType", () => {
  it("is true only for RELATES_TO", () => {
    expect(isSymmetricLinkType("RELATES_TO")).toBe(true);
    expect(isSymmetricLinkType("BLOCKS")).toBe(false);
    expect(isSymmetricLinkType("DUPLICATES")).toBe(false);
  });

  it("is false for an unknown type", () => {
    expect(isSymmetricLinkType("MADE_UP")).toBe(false);
  });
});
