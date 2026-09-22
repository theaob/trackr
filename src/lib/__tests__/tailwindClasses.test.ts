import fs from "fs";
import path from "path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { describe, expect, it } from "vitest";

// Tailwind silently emits nothing for a class it doesn't know -- a size from
// another Tailwind version, a plugin that isn't installed, a file outside the
// content globs. Those bugs only show up as a missing shadow or animation in a
// browser, so compile the real config against the real sources and check that
// every utility-looking class in src/ produced a rule.

const SRC = path.resolve("src");

// Prefixes of the utilities this project uses; a token is only checked when
// it starts with one, which keeps ordinary words in strings out of the way.
const UTILITY = new RegExp(
  "^-?(" +
    [
      "p[xytrbl]?", "m[xytrbl]?", "space-[xy]", "gap(-[xy])?", "w", "h", "min-w", "min-h", "max-w",
      "max-h", "size", "inset(-[xy])?", "top", "left", "right", "bottom", "z", "text", "font",
      "leading", "tracking", "bg", "from", "via", "to", "border(-[xytrbl])?", "rounded(-[tlbr]{1,2})?",
      "shadow", "ring(-offset)?", "outline", "opacity", "blur", "backdrop-blur", "animate",
      "fade-(in|out)", "zoom-(in|out)", "slide-(in-from|out-to)-(top|bottom|left|right)", "spin-(in|out)",
      "duration", "delay", "ease", "transition", "translate-[xy]", "scale(-[xy])?", "rotate",
      "grid-cols", "col-span", "row-span", "grow", "shrink", "basis", "order", "justify", "items",
      "self", "content", "place", "overflow", "whitespace", "break", "line-clamp", "object", "cursor",
      "select", "pointer-events", "fill", "stroke", "divide(-[xy])?", "decoration", "list", "align",
      "aspect", "columns",
    ].join("|") +
    ")-"
);

// Strings that look like utilities but aren't class names.
const NOT_CLASSES = new Set(["content-type", "self-registration"]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

function candidateClasses(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const source = fs.readFileSync(file, "utf8");
    for (const literal of Array.from(source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g))) {
      for (const token of literal[2].split(/\s+/)) {
        if (!/^[!\w:\-./\[\]%#()]+$/.test(token) || NOT_CLASSES.has(token)) continue;
        const utility = token.split(":").pop()!.replace(/^!/, "");
        if (UTILITY.test(utility) && !found.has(token)) found.set(token, path.relative(SRC, file));
      }
    }
  }
  return found;
}

async function generatedClasses(): Promise<Set<string>> {
  const config = loadConfig(path.resolve("tailwind.config.ts"));
  const { css } = await postcss([tailwind(config)]).process(
    "@tailwind base; @tailwind components; @tailwind utilities;",
    { from: undefined }
  );
  const classes = new Set<string>();
  for (const match of Array.from(css.matchAll(/\.((?:\\.|[\w-])+)/g))) classes.add(match[1].replace(/\\(.)/g, "$1"));
  return classes;
}

describe("Tailwind classes", () => {
  it("every utility class used in src/ generates CSS", async () => {
    const generated = await generatedClasses();
    const missing = Array.from(candidateClasses())
      .filter(([token]) => !generated.has(token.replace(/^!/, "")))
      .map(([token, file]) => `${token}  (${file})`);

    // Fix by using a class Tailwind 3 has, adding the size to tailwind.config.ts,
    // or, for a string that isn't a class at all, adding it to NOT_CLASSES.
    expect(missing).toEqual([]);
  }, 60_000);
});
