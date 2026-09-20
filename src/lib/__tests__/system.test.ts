import { describe, expect, it } from "vitest";
import { formatUptime, formatPlatform, resolveCommitHash } from "@/lib/systemUtils";

describe("formatUptime", () => {
  it("formats seconds", () => {
    expect(formatUptime(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatUptime(125)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(3665)).toBe("1h 1m");
  });

  it("formats days and hours", () => {
    expect(formatUptime(90000)).toBe("1d 1h 0m");
  });
});

describe("formatPlatform", () => {
  it("formats darwin to macOS", () => {
    expect(formatPlatform("darwin", "arm64")).toBe("macOS (arm64)");
    expect(formatPlatform("darwin", "x64")).toBe("macOS (x64)");
  });

  it("formats linux and win32", () => {
    expect(formatPlatform("linux", "x64")).toBe("Linux (x64)");
    expect(formatPlatform("win32", "x64")).toBe("Windows (x64)");
  });

  it("falls back to raw platform name if unknown", () => {
    expect(formatPlatform("freebsd", "x64")).toBe("freebsd (x64)");
  });
});

describe("resolveCommitHash", () => {
  it("prioritizes GIT_COMMIT environment variable", () => {
    const hash = resolveCommitHash({
      env: { GIT_COMMIT: "1a2b3c4d5e6f7a8b" },
    });
    expect(hash).toBe("1a2b3c4");
  });

  it("reads from GITHUB_SHA when GIT_COMMIT is absent", () => {
    const hash = resolveCommitHash({
      env: { GITHUB_SHA: "9f8e7d6c5b4a3a2b" },
    });
    expect(hash).toBe("9f8e7d6");
  });

  it("reads from NEXT_PUBLIC_GIT_COMMIT when present", () => {
    const hash = resolveCommitHash({
      env: { NEXT_PUBLIC_GIT_COMMIT: "abcdef987654" },
    });
    expect(hash).toBe("abcdef9");
  });

  it("reads from buildInfo when env vars are absent", () => {
    const hash = resolveCommitHash({
      env: {},
      buildInfo: { commitHash: "77aa88bb99" },
    });
    expect(hash).toBe("77aa88b");
  });

  it("reads from gitCommitGetter when env and buildInfo are absent", () => {
    const hash = resolveCommitHash({
      env: {},
      gitCommitGetter: () => "c0ffee12345",
    });
    expect(hash).toBe("c0ffee1");
  });

  it("falls back to deterministic version hash and never hardcodes stale dfb2de3", () => {
    const hash1 = resolveCommitHash({
      env: {},
      fallbackVersion: "0.31.4",
    });
    const hash2 = resolveCommitHash({
      env: {},
      fallbackVersion: "0.31.5",
    });

    expect(hash1).not.toBe("dfb2de3");
    expect(hash2).not.toBe("dfb2de3");
    expect(hash1).not.toBe(hash2);
    expect(hash1).toHaveLength(7);
    expect(hash2).toHaveLength(7);
  });
});


