import { describe, it, expect } from "vitest";
import {
  applyWrapFormatting,
  applyLinePrefixFormatting,
  insertMarkdownTable,
  insertMarkdownLink,
  insertCodeBlock,
  handleTabIndent,
} from "../markdownEditorUtils";

describe("markdownEditorUtils", () => {
  describe("applyWrapFormatting", () => {
    it("wraps selected text with bold markers (**)", () => {
      const text = "Hello world!";
      const res = applyWrapFormatting(text, 6, 11, "**");
      expect(res.newText).toBe("Hello **world**!");
      expect(res.newSelectionStart).toBe(8); // inside wrapper
      expect(res.newSelectionEnd).toBe(13);
    });

    it("unwraps text if already wrapped in bold", () => {
      const text = "Hello **world**!";
      const res = applyWrapFormatting(text, 6, 15, "**");
      expect(res.newText).toBe("Hello world!");
      expect(res.newSelectionStart).toBe(6);
      expect(res.newSelectionEnd).toBe(11);
    });

    it("inserts placeholder when cursor is collapsed without selection", () => {
      const text = "Hello ";
      const res = applyWrapFormatting(text, 6, 6, "*", "*", "italic");
      expect(res.newText).toBe("Hello *italic*");
      expect(res.newSelectionStart).toBe(7);
      expect(res.newSelectionEnd).toBe(13);
    });

    it("handles strikethrough (~~)", () => {
      const text = "deprecated feature";
      const res = applyWrapFormatting(text, 0, 10, "~~");
      expect(res.newText).toBe("~~deprecated~~ feature");
    });

    it("handles inline code (`)", () => {
      const text = "use const foo = 1";
      const res = applyWrapFormatting(text, 4, 17, "`");
      expect(res.newText).toBe("use `const foo = 1`");
    });
  });

  describe("applyLinePrefixFormatting", () => {
    it("adds bullet list marker (- ) to a single line", () => {
      const text = "First item\nSecond item";
      const res = applyLinePrefixFormatting(text, 0, 5, "- ");
      expect(res.newText).toBe("- First item\nSecond item");
    });

    it("toggles off bullet list marker if already present", () => {
      const text = "- First item\nSecond item";
      const res = applyLinePrefixFormatting(text, 0, 5, "- ");
      expect(res.newText).toBe("First item\nSecond item");
    });

    it("adds numbered list markers (1. , 2. ) to multiple selected lines", () => {
      const text = "Apple\nBanana\nOrange";
      const res = applyLinePrefixFormatting(text, 0, text.length, "1. ", { numbered: true });
      expect(res.newText).toBe("1. Apple\n2. Banana\n3. Orange");
    });

    it("adds task checklist marker (- [ ] )", () => {
      const text = "Write tests\nFix bug";
      const res = applyLinePrefixFormatting(text, 0, 11, "- [ ] ");
      expect(res.newText).toBe("- [ ] Write tests\nFix bug");
    });

    it("applies and changes heading levels properly", () => {
      const text = "Page Title";
      const res1 = applyLinePrefixFormatting(text, 0, 5, "# ", { isHeading: true });
      expect(res1.newText).toBe("# Page Title");

      const res2 = applyLinePrefixFormatting(res1.newText, 0, 5, "## ", { isHeading: true });
      expect(res2.newText).toBe("## Page Title");

      // Toggle off heading
      const res3 = applyLinePrefixFormatting(res2.newText, 0, 5, "## ", { isHeading: true });
      expect(res3.newText).toBe("Page Title");
    });

    it("applies blockquote (> ) prefix", () => {
      const text = "A wise quotation";
      const res = applyLinePrefixFormatting(text, 2, 7, "> ");
      expect(res.newText).toBe("> A wise quotation");
    });
  });

  describe("insertMarkdownTable", () => {
    it("generates and inserts a markdown table skeleton", () => {
      const text = "Above table";
      const res = insertMarkdownTable(text, text.length, text.length, 2, 3);
      expect(res.newText).toContain("| Header 1 | Header 2 | Header 3 |");
      expect(res.newText).toContain("| --- | --- | --- |");
      expect(res.newText).toContain("| Cell 1.1 | Cell 1.2 | Cell 1.3 |");
      expect(res.newText).toContain("| Cell 2.1 | Cell 2.2 | Cell 2.3 |");
    });
  });

  describe("insertMarkdownLink", () => {
    it("wraps selected text in markdown link", () => {
      const text = "Visit Google today";
      const res = insertMarkdownLink(text, 6, 12, "https://google.com");
      expect(res.newText).toBe("Visit [Google](https://google.com) today");
    });

    it("inserts custom link text when specified", () => {
      const text = "Click here: ";
      const res = insertMarkdownLink(text, text.length, text.length, "https://github.com", "GitHub");
      expect(res.newText).toBe("Click here: [GitHub](https://github.com)");
    });
  });

  describe("insertCodeBlock", () => {
    it("wraps selected code in fenced code block", () => {
      const text = "const x = 42;";
      const res = insertCodeBlock(text, 0, text.length, "ts");
      expect(res.newText).toBe("```ts\nconst x = 42;\n```");
    });
  });

  describe("handleTabIndent", () => {
    it("inserts 2 spaces on Tab without selection", () => {
      const text = "hello";
      const res = handleTabIndent(text, 2, 2, false);
      expect(res.newText).toBe("he  llo");
    });

    it("indents multiple lines on Tab", () => {
      const text = "line1\nline2";
      const res = handleTabIndent(text, 0, text.length, false);
      expect(res.newText).toBe("  line1\n  line2");
    });

    it("outdents lines on Shift+Tab", () => {
      const text = "  line1\n  line2";
      const res = handleTabIndent(text, 0, text.length, true);
      expect(res.newText).toBe("line1\nline2");
    });
  });
});
