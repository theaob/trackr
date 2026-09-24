import { describe, expect, it } from "vitest";
import { csvCell, issuesToCSV } from "@/lib/issueCsv";
import type { Issue } from "@/types";

describe("issue CSV export", () => {
  it("stops spreadsheets running cells as formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell('say "hi", then go')).toBe('"say ""hi"", then go"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });

  it("exports the columns on screen, in the table's order", () => {
    const issue = { key: "APOLLO-1", title: "Crash, on login", status: "TODO", assignee: null } as unknown as Issue;
    expect(issuesToCSV([issue], ["status", "key", "title", "assignee"])).toBe('Key,Summary,Status,Assignee\r\nAPOLLO-1,"Crash, on login",TODO,');
  });
});
