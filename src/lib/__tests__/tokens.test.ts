import { describe, expect, it } from "vitest";
import {
  TOKEN_DISPLAY_PREFIX_LENGTH,
  TOKEN_PREFIX,
  generateRawToken,
  hasTokenPrefix,
  hashToken,
} from "@/lib/auth/tokens";

describe("personal access tokens", () => {
  it("carries the Tamam prefix, and still recognises tokens made as Trackr", () => {
    const token = generateRawToken();
    expect(TOKEN_PREFIX).toBe("tamam_pat_");
    expect(token.startsWith("tamam_pat_")).toBe(true);
    expect(hasTokenPrefix(token)).toBe(true);
    expect(hasTokenPrefix("trackr_pat_0123456789abcdef")).toBe(true);
    expect(hasTokenPrefix("jira_pat_0123456789abcdef")).toBe(false);
  });

  it("has 48 hex characters of entropy after the prefix", () => {
    const body = generateRawToken().slice(TOKEN_PREFIX.length);
    expect(body).toMatch(/^[0-9a-f]{48}$/);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRawToken()));
    expect(tokens.size).toBe(50);
  });

  // The stored prefix is what the settings screen shows next to the masked
  // body, so it has to keep a few identifying characters past the prefix.
  it("shows the prefix plus five characters", () => {
    const token = generateRawToken();
    const shown = token.slice(0, TOKEN_DISPLAY_PREFIX_LENGTH);
    expect(shown.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(shown).toHaveLength(TOKEN_PREFIX.length + 5);
    expect(shown).not.toBe(token);
  });

  it("hashes to a stable SHA-256 digest and never stores the token itself", () => {
    const token = generateRawToken();
    const digest = hashToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(hashToken(token));
    expect(digest).not.toContain(token);
    expect(hashToken(generateRawToken())).not.toBe(digest);
  });
});
