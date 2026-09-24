import { describe, expect, it } from "vitest";
import { filterOptions, nextActiveIndex, typeaheadIndex } from "../listNavigation";
import { parseHexColor } from "../StatusLozenge";

const opts = (...disabled: boolean[]) => disabled.map((d) => ({ disabled: d }));

describe("nextActiveIndex", () => {
  it("moves down and up, wrapping at the ends", () => {
    const list = opts(false, false, false);
    expect(nextActiveIndex(list, 0, "ArrowDown")).toBe(1);
    expect(nextActiveIndex(list, 2, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(list, 0, "ArrowUp")).toBe(2);
  });

  it("starts at the top on Down and the bottom on Up when nothing is active", () => {
    const list = opts(false, false, false);
    expect(nextActiveIndex(list, -1, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(list, -1, "ArrowUp")).toBe(2);
  });

  it("skips disabled options, including at Home and End", () => {
    const list = opts(true, false, true, false, true);
    expect(nextActiveIndex(list, 1, "ArrowDown")).toBe(3);
    expect(nextActiveIndex(list, 3, "ArrowDown")).toBe(1);
    expect(nextActiveIndex(list, 1, "ArrowUp")).toBe(3);
    expect(nextActiveIndex(list, 3, "Home")).toBe(1);
    expect(nextActiveIndex(list, 1, "End")).toBe(3);
  });

  it("returns -1 when every option is disabled or the list is empty", () => {
    expect(nextActiveIndex(opts(true, true), 0, "ArrowDown")).toBe(-1);
    expect(nextActiveIndex([], -1, "ArrowDown")).toBe(-1);
  });

  it("ignores keys that don't move", () => {
    expect(nextActiveIndex(opts(false), 0, "a")).toBeNull();
    expect(nextActiveIndex(opts(false), 0, "Enter")).toBeNull();
  });
});

describe("typeaheadIndex", () => {
  const people = [{ label: "Ada" }, { label: "Alan" }, { label: "Grace" }, { label: "Ian", disabled: true }, { label: "Iris" }];

  it("jumps to the next label starting with the letter, cycling on repeats", () => {
    expect(typeaheadIndex(people, -1, "a")).toBe(0);
    expect(typeaheadIndex(people, 0, "a")).toBe(1);
    expect(typeaheadIndex(people, 1, "a")).toBe(0);
  });

  it("matches a longer prefix from the current option", () => {
    expect(typeaheadIndex(people, 0, "al")).toBe(1);
    expect(typeaheadIndex(people, 0, "gr")).toBe(2);
  });

  it("skips disabled options and keeps the current one when nothing matches", () => {
    expect(typeaheadIndex(people, 2, "i")).toBe(4);
    expect(typeaheadIndex(people, 2, "z")).toBe(2);
  });

  it("matches a capital I the same way in every locale", () => {
    expect(typeaheadIndex([{ label: "Issue" }], -1, "i")).toBe(0);
  });
});

describe("filterOptions", () => {
  const options = [
    { label: "Ada Lovelace", description: "ada@example.com" },
    { label: "Grace Hopper", description: "grace@example.com", keywords: "admin" },
  ];

  it("keeps options containing every word, in order", () => {
    expect(filterOptions(options, "grace").map((o) => o.label)).toEqual(["Grace Hopper"]);
    expect(filterOptions(options, "example ada").map((o) => o.label)).toEqual(["Ada Lovelace"]);
    expect(filterOptions(options, "admin").map((o) => o.label)).toEqual(["Grace Hopper"]);
  });

  it("returns everything for an empty query and nothing for no match", () => {
    expect(filterOptions(options, "  ")).toHaveLength(2);
    expect(filterOptions(options, "linus")).toHaveLength(0);
  });
});

describe("parseHexColor", () => {
  it("reads short and long hex colours", () => {
    expect(parseHexColor("#2F5BEA")).toEqual({ r: 47, g: 91, b: 234 });
    expect(parseHexColor("#fa0")).toEqual({ r: 255, g: 170, b: 0 });
  });

  it("rejects anything else, so it can't be used to inject CSS", () => {
    expect(parseHexColor("red")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor("#fff); background: url(x)")).toBeNull();
    expect(parseHexColor(null)).toBeNull();
  });
});
