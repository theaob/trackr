import { describe, expect, it } from "vitest";
import { issueHref, legacyIssueRedirect, projectKeyOfIssue } from "@/lib/issueUrls";

describe("issue URLs", () => {
  it("puts an issue at /projects/KEY/issues/ISSUE", () => {
    expect(issueHref("APOLLO", "APOLLO-3")).toBe("/projects/APOLLO/issues/APOLLO-3");
    expect(projectKeyOfIssue("ORION2-14")).toBe("ORION2");
  });

  it("redirects old ?selectedIssue= and ?issue= links to the issue page", () => {
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: "apollo-3" })).toBe("/projects/APOLLO/issues/APOLLO-3");
    expect(legacyIssueRedirect("APOLLO", { issue: "ORION-9" })).toBe("/projects/ORION/issues/ORION-9");
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: ["APOLLO-1", "APOLLO-2"] })).toBe("/projects/APOLLO/issues/APOLLO-1");
  });

  it("accepts an id-shaped value under the current project", () => {
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: "cmf3x9abc0001" })).toBe("/projects/APOLLO/issues/cmf3x9abc0001");
  });

  it("ignores anything else, so the parameter can't build another URL", () => {
    expect(legacyIssueRedirect("APOLLO", {})).toBeNull();
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: "//evil.example" })).toBeNull();
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: "../settings" })).toBeNull();
    expect(legacyIssueRedirect("APOLLO", { selectedIssue: "a b" })).toBeNull();
  });
});
