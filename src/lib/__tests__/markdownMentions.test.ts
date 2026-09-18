import { describe, expect, it } from "vitest";
import { preprocessMentions } from "@/lib/markdownMentions";

const users = [
  { id: "u1", name: "Alex Chen" },
  { id: "u2", name: "Bailey" },
];

describe("preprocessMentions", () => {
  it("returns an empty string for empty input", () => {
    expect(preprocessMentions("", users)).toBe("");
    expect(preprocessMentions(null as unknown as string, users)).toBe("");
  });

  it("converts a bracketed mention to a markdown mention link", () => {
    expect(preprocessMentions("ping @[Alex Chen] please", users)).toBe(
      "ping [@Alex Chen](mention:u1) please"
    );
  });

  it("converts a simple full-name mention to a markdown mention link", () => {
    expect(preprocessMentions("ping @Alex Chen please", users)).toBe(
      "ping [@Alex Chen](mention:u1) please"
    );
  });

  it("converts a first-name mention to a markdown mention link", () => {
    expect(preprocessMentions("thanks @Alex", users)).toBe("thanks [@Alex Chen](mention:u1)");
  });

  it("is case-insensitive when matching known users", () => {
    expect(preprocessMentions("hi @alex chen", users)).toBe("hi [@Alex Chen](mention:u1)");
  });

  it("keeps an unresolved mention as a link with an unknown target", () => {
    expect(preprocessMentions("cc @Nobody Here", users)).toBe(
      "cc [@Nobody Here](mention:unknown:Nobody%20Here)"
    );
  });

  it("converts multiple mentions in the same string", () => {
    expect(preprocessMentions("@Alex Chen, please loop in @Bailey, thanks", users)).toBe(
      "[@Alex Chen](mention:u1), please loop in [@Bailey](mention:u2), thanks"
    );
  });

  it("leaves an @word inside a fenced code block untouched", () => {
    const text = "See below:\n```\nconst x = 1; // @Alex Chen\n```\nThanks @Alex Chen";
    const result = preprocessMentions(text, users);
    expect(result).toContain("const x = 1; // @Alex Chen");
    expect(result).toContain("Thanks [@Alex Chen](mention:u1)");
  });

  it("leaves an @word inside an inline code span untouched", () => {
    const text = "Use `@Alex Chen` as a placeholder, not @Alex Chen";
    const result = preprocessMentions(text, users);
    expect(result).toContain("`@Alex Chen`");
    expect(result).toContain("not [@Alex Chen](mention:u1)");
  });

  it("handles text with no users provided", () => {
    expect(preprocessMentions("hi @Someone", [])).toBe("hi [@Someone](mention:unknown:Someone)");
  });
});
