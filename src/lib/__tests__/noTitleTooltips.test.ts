import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A title attribute shows only to mouse users after a delay; keyboard, touch
// and most screen reader users never get it. Hints use the Tooltip primitive,
// and names use aria-label or visible text.
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

function titleAttributesOnElements(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      // Lower-case tags are HTML elements; components decide what their own title prop means.
      if (/^[a-z]/.test(tag)) {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(source) === "title") {
            const { line } = source.getLineAndCharacterOfPosition(attr.getStart(source));
            found.push(`${path.relative(process.cwd(), file)}:${line + 1} <${tag} title>`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("tooltips", () => {
  it("no HTML element uses a title attribute", () => {
    const offenders = sourceFiles(path.resolve(__dirname, "../../")).flatMap(titleAttributesOnElements);
    expect(offenders).toEqual([]);
  });
});
