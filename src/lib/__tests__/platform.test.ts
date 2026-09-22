import { describe, expect, it } from "vitest";
import { isMacUserAgent, modKeyLabel } from "@/lib/platform";

describe("isMacUserAgent", () => {
  it("recognizes desktop Mac user agents", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
      )
    ).toBe(true);
  });

  it("recognizes iOS user agents", () => {
    expect(
      isMacUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    ).toBe(true);
  });

  it("does not flag Windows as Mac", () => {
    expect(
      isMacUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    ).toBe(false);
  });

  it("does not flag Linux as Mac", () => {
    expect(isMacUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")).toBe(
      false
    );
  });
});

describe("modKeyLabel", () => {
  it("shows the Mac symbol on Mac", () => {
    expect(modKeyLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("⌘");
  });

  it("shows Ctrl on Windows", () => {
    expect(modKeyLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Ctrl");
  });
});
