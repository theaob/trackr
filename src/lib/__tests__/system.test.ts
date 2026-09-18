import { describe, expect, it } from "vitest";
import { formatUptime, formatPlatform } from "@/lib/systemUtils";

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
