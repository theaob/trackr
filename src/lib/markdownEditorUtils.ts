/**
 * Utilities for manipulating markdown text in an editor textarea.
 */

export interface TextTransformResult {
  newText: string;
  newSelectionStart: number;
  newSelectionEnd: number;
}

/**
 * Wraps selected text with prefix and suffix (e.g. `**` for bold, `*` for italic, `~~` for strikethrough, `` ` `` for code).
 * If text is already wrapped, toggles it off.
 * If no text is selected, inserts prefix + defaultPlaceholder + suffix and selects defaultPlaceholder.
 */
export function applyWrapFormatting(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string = prefix,
  defaultPlaceholder: string = "text"
): TextTransformResult {
  const isCollapsed = selectionStart === selectionEnd;

  if (isCollapsed) {
    // Check if cursor is right inside existing wrapper
    const prefixLen = prefix.length;
    const suffixLen = suffix.length;
    const beforeCursor = text.slice(Math.max(0, selectionStart - prefixLen), selectionStart);
    const afterCursor = text.slice(selectionStart, selectionStart + suffixLen);

    if (beforeCursor === prefix && afterCursor === suffix) {
      // Remove wrapper
      const newText =
        text.slice(0, selectionStart - prefixLen) + text.slice(selectionStart + suffixLen);
      return {
        newText,
        newSelectionStart: selectionStart - prefixLen,
        newSelectionEnd: selectionStart - prefixLen,
      };
    }

    // Insert placeholder wrapped in prefix/suffix
    const insert = `${prefix}${defaultPlaceholder}${suffix}`;
    const newText = text.slice(0, selectionStart) + insert + text.slice(selectionEnd);
    return {
      newText,
      newSelectionStart: selectionStart + prefixLen,
      newSelectionEnd: selectionStart + prefixLen + defaultPlaceholder.length,
    };
  }

  const selectedText = text.slice(selectionStart, selectionEnd);

  // Check if selection is already wrapped internally or externally
  if (
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix) &&
    selectedText.length >= prefix.length + suffix.length
  ) {
    // Unwrap from inside the selection
    const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length);
    const newText = text.slice(0, selectionStart) + unwrapped + text.slice(selectionEnd);
    return {
      newText,
      newSelectionStart: selectionStart,
      newSelectionEnd: selectionStart + unwrapped.length,
    };
  }

  // Check if selection is wrapped externally
  const beforeSelection = text.slice(Math.max(0, selectionStart - prefix.length), selectionStart);
  const afterSelection = text.slice(selectionEnd, selectionEnd + suffix.length);
  if (beforeSelection === prefix && afterSelection === suffix) {
    const newText =
      text.slice(0, selectionStart - prefix.length) +
      selectedText +
      text.slice(selectionEnd + suffix.length);
    return {
      newText,
      newSelectionStart: selectionStart - prefix.length,
      newSelectionEnd: selectionEnd - prefix.length,
    };
  }

  // Normal wrap
  const wrapped = `${prefix}${selectedText}${suffix}`;
  const newText = text.slice(0, selectionStart) + wrapped + text.slice(selectionEnd);
  return {
    newText,
    newSelectionStart: selectionStart + prefix.length,
    newSelectionEnd: selectionEnd + prefix.length,
  };
}

/**
 * Prefixes the beginning of lines touching the selection with a marker (e.g. lists, quotes, headings).
 */
export function applyLinePrefixFormatting(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  options?: {
    isHeading?: boolean;
    numbered?: boolean;
  }
): TextTransformResult {
  // Find the start of the first line
  const lineStartIndex = text.lastIndexOf("\n", selectionStart - 1) + 1;
  // Find the end of the last line
  let lineEndIndex = text.indexOf("\n", selectionEnd);
  if (lineEndIndex === -1) {
    lineEndIndex = text.length;
  }

  const linesSlice = text.slice(lineStartIndex, lineEndIndex);
  const lines = linesSlice.split("\n");

  const listPattern = /^(\s*)([-*+]|\d+\.|\- \[[ xX]\]|>)\s+/;
  const headingPattern = /^(\s*)(#{1,6}\s+)/;

  let allHavePrefix = true;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    if (options?.isHeading) {
      if (!line.startsWith(prefix)) {
        allHavePrefix = false;
        break;
      }
    } else {
      if (!line.startsWith(prefix)) {
        allHavePrefix = false;
        break;
      }
    }
  }

  const transformedLines = lines.map((line, idx) => {
    if (line.trim().length === 0 && lines.length > 1) return line;

    if (options?.isHeading) {
      // Remove any existing heading
      const cleaned = line.replace(headingPattern, "");
      if (allHavePrefix) {
        // Toggle off
        return cleaned;
      }
      return `${prefix}${cleaned}`;
    }

    if (options?.numbered) {
      const cleaned = line.replace(listPattern, "$1");
      if (allHavePrefix) {
        return cleaned;
      }
      return `${idx + 1}. ${cleaned}`;
    }

    // Standard list / quote / task prefix
    if (allHavePrefix) {
      // Remove prefix
      if (line.startsWith(prefix)) {
        return line.slice(prefix.length);
      }
      return line;
    } else {
      // Remove any other conflicting list markers
      const cleaned = line.replace(listPattern, "$1");
      return `${prefix}${cleaned}`;
    }
  });

  const transformedText = transformedLines.join("\n");
  const newText = text.slice(0, lineStartIndex) + transformedText + text.slice(lineEndIndex);

  const lengthDiff = transformedText.length - linesSlice.length;

  return {
    newText,
    newSelectionStart: lineStartIndex,
    newSelectionEnd: Math.max(lineStartIndex, selectionEnd + lengthDiff),
  };
}

/**
 * Inserts a markdown table at cursor.
 */
export function insertMarkdownTable(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  rows: number = 2,
  cols: number = 3
): TextTransformResult {
  const headers = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
  const separators = Array.from({ length: cols }, () => "---");
  const headerRow = `| ${headers.join(" | ")} |`;
  const sepRow = `| ${separators.join(" | ")} |`;

  const dataRows: string[] = [];
  for (let r = 1; r <= rows; r++) {
    const rowCells = Array.from({ length: cols }, (_, c) => `Cell ${r}.${c + 1}`);
    dataRows.push(`| ${rowCells.join(" | ")} |`);
  }

  const tableMarkdown = `\n${headerRow}\n${sepRow}\n${dataRows.join("\n")}\n`;

  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);
  const needPrefixNewline = before.length > 0 && !before.endsWith("\n");
  const needSuffixNewline = after.length > 0 && !after.startsWith("\n");

  const fullInsert = `${needPrefixNewline ? "\n" : ""}${tableMarkdown}${
    needSuffixNewline ? "\n" : ""
  }`;
  const newText = before + fullInsert + after;

  const newPos = before.length + fullInsert.length;
  return {
    newText,
    newSelectionStart: newPos,
    newSelectionEnd: newPos,
  };
}

/**
 * Inserts or wraps text with markdown link `[text](url)`.
 */
export function insertMarkdownLink(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  url: string = "https://",
  linkText?: string
): TextTransformResult {
  const selectedText = text.slice(selectionStart, selectionEnd);
  const displayText = linkText || selectedText || "link text";
  const formatted = `[${displayText}](${url})`;

  const newText = text.slice(0, selectionStart) + formatted + text.slice(selectionEnd);
  return {
    newText,
    newSelectionStart: selectionStart + 1,
    newSelectionEnd: selectionStart + 1 + displayText.length,
  };
}

/**
 * Inserts a fenced code block ```lang ... ```.
 */
export function insertCodeBlock(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  lang: string = ""
): TextTransformResult {
  const selectedText = text.slice(selectionStart, selectionEnd);
  const codeContent = selectedText || "// code here";

  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);
  const needPrefixNewline = before.length > 0 && !before.endsWith("\n");
  const needSuffixNewline = after.length > 0 && !after.startsWith("\n");

  const prefixNl = needPrefixNewline ? "\n" : "";
  const suffixNl = needSuffixNewline ? "\n" : "";
  const block = prefixNl + "```" + lang + "\n" + codeContent + "\n```" + suffixNl;
  const newText = before + block + after;

  const contentStart = before.length + (needPrefixNewline ? 1 : 0) + 3 + lang.length + 1;
  return {
    newText,
    newSelectionStart: contentStart,
    newSelectionEnd: contentStart + codeContent.length,
  };
}

/**
 * Smart indentation helper for Tab and Shift+Tab in textareas.
 */
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;

/**
 * Whether Tab in the editor should indent rather than move focus: only on a
 * list item or across a multi-line selection, where indentation means
 * something in Markdown.
 */
export function shouldIndentOnTab(text: string, selectionStart: number, selectionEnd: number): boolean {
  const selected = text.slice(selectionStart, selectionEnd);
  if (selected.includes("\n")) return true;
  const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
  let lineEnd = text.indexOf("\n", selectionStart);
  if (lineEnd === -1) lineEnd = text.length;
  return LIST_ITEM.test(text.slice(lineStart, lineEnd));
}

export function handleTabIndent(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean = false
): TextTransformResult {
  const lineStartIndex = text.lastIndexOf("\n", selectionStart - 1) + 1;
  let lineEndIndex = text.indexOf("\n", selectionEnd);
  if (lineEndIndex === -1) lineEndIndex = text.length;

  const linesSlice = text.slice(lineStartIndex, lineEndIndex);
  const lines = linesSlice.split("\n");

  if (outdent) {
    let removedCount = 0;
    const transformed = lines.map((line) => {
      if (line.startsWith("  ")) {
        removedCount += 2;
        return line.slice(2);
      } else if (line.startsWith(" ")) {
        removedCount += 1;
        return line.slice(1);
      } else if (line.startsWith("\t")) {
        removedCount += 1;
        return line.slice(1);
      }
      return line;
    });

    const newSlice = transformed.join("\n");
    return {
      newText: text.slice(0, lineStartIndex) + newSlice + text.slice(lineEndIndex),
      newSelectionStart: Math.max(lineStartIndex, selectionStart - 2),
      newSelectionEnd: Math.max(lineStartIndex, selectionEnd - removedCount),
    };
  } else {
    if (selectionStart === selectionEnd && !linesSlice.includes("\n")) {
      // Single cursor on a list item: nest it by indenting the whole line.
      if (LIST_ITEM.test(linesSlice)) {
        return {
          newText: text.slice(0, lineStartIndex) + "  " + text.slice(lineStartIndex),
          newSelectionStart: selectionStart + 2,
          newSelectionEnd: selectionStart + 2,
        };
      }
      // Single cursor elsewhere: just insert 2 spaces at cursor
      return {
        newText: text.slice(0, selectionStart) + "  " + text.slice(selectionEnd),
        newSelectionStart: selectionStart + 2,
        newSelectionEnd: selectionStart + 2,
      };
    }

    // Multi-line selection: indent each line by 2 spaces
    const transformed = lines.map((line) => "  " + line);
    const newSlice = transformed.join("\n");
    const addedCount = lines.length * 2;

    return {
      newText: text.slice(0, lineStartIndex) + newSlice + text.slice(lineEndIndex),
      newSelectionStart: selectionStart + 2,
      newSelectionEnd: selectionEnd + addedCount,
    };
  }
}
