import { describe, expect, it } from "vitest";
import { escapeRegExp, mentionsUser } from "@/lib/mentions";

describe("escapeRegExp", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegExp("C++")).toBe("C\\+\\+");
    expect(escapeRegExp("a(b)c")).toBe("a\\(b\\)c");
  });
});

describe("mentionsUser", () => {
  it("matches a full name, a bracketed name and a first name", () => {
    expect(mentionsUser("ping @Alex Chen please", "Alex Chen")).toBe(true);
    expect(mentionsUser("ping @[Alex Chen] please", "Alex Chen")).toBe(true);
    expect(mentionsUser("ping @Alex please", "Alex Chen")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(mentionsUser("ping @alex please", "Alex Chen")).toBe(true);
  });

  it("does not match an email address", () => {
    expect(mentionsUser("mail alex@example.com", "Alex Chen")).toBe(false);
  });

  it("does not match a longer name that starts the same way", () => {
    expect(mentionsUser("@Alexandra shipped it", "Alex Chen")).toBe(false);
  });

  // A name containing regex metacharacters used to build an invalid pattern,
  // throwing and failing every issue write.
  it("handles names with regex metacharacters", () => {
    expect(() => mentionsUser("hi @C++ there", "C++ Dev")).not.toThrow();
    expect(mentionsUser("hi @C++ there", "C++ Dev")).toBe(true);
    expect(mentionsUser("nothing here", "(unclosed")).toBe(false);
    expect(mentionsUser("a*b", "a*b c")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(mentionsUser("", "Alex Chen")).toBe(false);
    expect(mentionsUser("@Alex", "")).toBe(false);
  });
});
