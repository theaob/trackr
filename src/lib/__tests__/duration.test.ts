import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "@/lib/duration";

describe("parseDuration", () => {
  it("parses a single unit", () => {
    expect(parseDuration("3h")).toBe(3 * 3600);
    expect(parseDuration("30m")).toBe(30 * 60);
    expect(parseDuration("2d")).toBe(2 * 8 * 3600);
    expect(parseDuration("1w")).toBe(5 * 8 * 3600);
  });

  it("parses multiple units regardless of order", () => {
    expect(parseDuration("1d 2h")).toBe(8 * 3600 + 2 * 3600);
    expect(parseDuration("2h 1d")).toBe(8 * 3600 + 2 * 3600);
  });

  it("is tolerant of missing spaces and mixed case", () => {
    expect(parseDuration("3h30m")).toBe(3 * 3600 + 30 * 60);
    expect(parseDuration("2D 4H")).toBe(2 * 8 * 3600 + 4 * 3600);
  });

  it("supports fractional values", () => {
    expect(parseDuration("1.5h")).toBe(1.5 * 3600);
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("   ")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("3x")).toBeNull();
  });

  it("returns null when a valid token is followed by leftover junk", () => {
    expect(parseDuration("3h junk")).toBeNull();
  });

  it("returns null for a bare number with no unit", () => {
    expect(parseDuration("10")).toBeNull();
  });

  it("accepts an explicit zero as distinct from empty", () => {
    expect(parseDuration("0h")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats a single unit", () => {
    expect(formatDuration(3 * 3600)).toBe("3h");
    expect(formatDuration(30 * 60)).toBe("30m");
  });

  it("formats a combination, largest unit first", () => {
    expect(formatDuration(8 * 3600 + 2 * 3600 + 15 * 60)).toBe("1d 2h 15m");
  });

  it("formats a full week/day/hour/minute combination", () => {
    const seconds = 5 * 8 * 3600 + 8 * 3600 + 3 * 3600 + 10 * 60;
    expect(formatDuration(seconds)).toBe("1w 1d 3h 10m");
  });

  it("returns '0m' for zero or negative input", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-100)).toBe("0m");
  });

  it("round-trips through parseDuration", () => {
    const original = "2w 3d 4h 5m";
    const seconds = parseDuration(original);
    expect(seconds).not.toBeNull();
    expect(formatDuration(seconds as number)).toBe(original);
  });
});
