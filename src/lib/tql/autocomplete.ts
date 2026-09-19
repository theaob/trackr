import { TQLLexer } from "./lexer";
import { TQLToken } from "./tokens";

export interface TQLSuggestion {
  label: string;
  insertText: string;
  detail: string;
  type: "field" | "operator" | "value" | "function" | "keyword";
}

export interface TQLAutocompleteContext {
  projects?: { key: string; name: string }[];
  statuses?: string[];
  users?: { id: string; name: string; email?: string }[];
  sprints?: string[];
  versions?: string[];
  labels?: string[];
  components?: string[];
}

const COMMON_FIELDS = [
  { label: "project", detail: "Project key or name", type: "field" as const },
  { label: "type", detail: "Issue type (Bug, Story, Task...)", type: "field" as const },
  { label: "status", detail: "Workflow status", type: "field" as const },
  { label: "statusCategory", detail: "Category (TODO, IN_PROGRESS, DONE)", type: "field" as const },
  { label: "priority", detail: "Priority level (High, Lowest...)", type: "field" as const },
  { label: "assignee", detail: "Assigned user or currentUser()", type: "field" as const },
  { label: "reporter", detail: "Creator or currentUser()", type: "field" as const },
  { label: "sprint", detail: "Sprint name or openSprints()", type: "field" as const },
  { label: "fixVersion", detail: "Release version or unreleasedVersions()", type: "field" as const },
  { label: "parent", detail: "Parent epic key", type: "field" as const },
  { label: "labels", detail: "Issue tags", type: "field" as const },
  { label: "component", detail: "Project component", type: "field" as const },
  { label: "storyPoints", detail: "Story points estimate", type: "field" as const },
  { label: "created", detail: "Creation date (e.g. >= -7d)", type: "field" as const },
  { label: "updated", detail: "Last updated date", type: "field" as const },
  { label: "dueDate", detail: "Due date", type: "field" as const },
  { label: "summary", detail: "Issue title text search", type: "field" as const },
  { label: "description", detail: "Issue description text search", type: "field" as const },
  { label: "text", detail: "Combined summary & description text", type: "field" as const },
];

const STANDARD_OPERATORS = [
  { label: "=", detail: "Equals", type: "operator" as const },
  { label: "!=", detail: "Not equals", type: "operator" as const },
  { label: "in", detail: "In value list", type: "operator" as const },
  { label: "not in", detail: "Not in value list", type: "operator" as const },
  { label: "is EMPTY", detail: "Is unassigned or null", type: "operator" as const },
  { label: "is not EMPTY", detail: "Has a value", type: "operator" as const },
];

const COMPARISON_OPERATORS = [
  { label: "=", detail: "Equals", type: "operator" as const },
  { label: "!=", detail: "Not equals", type: "operator" as const },
  { label: ">=", detail: "Greater than or equal", type: "operator" as const },
  { label: "<=", detail: "Less than or equal", type: "operator" as const },
  { label: ">", detail: "Greater than", type: "operator" as const },
  { label: "<", detail: "Less than", type: "operator" as const },
  { label: "in", detail: "In list", type: "operator" as const },
];

const TEXT_OPERATORS = [
  { label: "~", detail: "Contains text", type: "operator" as const },
  { label: "!~", detail: "Does not contain text", type: "operator" as const },
  { label: "=", detail: "Exact match", type: "operator" as const },
];

export function getTQLCompletions(
  query: string,
  cursorPos: number,
  context: TQLAutocompleteContext = {}
): TQLSuggestion[] {
  const textBefore = query.slice(0, cursorPos);
  const trimmedBefore = textBefore.trimEnd();

  // If query is empty or ends with boolean conjunction
  if (
    !trimmedBefore ||
    /\b(AND|OR|NOT|\()\s*$/i.test(trimmedBefore)
  ) {
    const currentWord = getCurrentWord(textBefore);
    return filterSuggestions(
      COMMON_FIELDS.map((f) => ({
        label: f.label,
        insertText: `${f.label} `,
        detail: f.detail,
        type: f.type,
      })),
      currentWord
    );
  }

  // Tokenize the input up to cursor
  const lexer = new TQLLexer(textBefore);
  const tokens = lexer.tokenize().filter((t) => t.type !== "EOF");
  if (tokens.length === 0) {
    return filterSuggestions(
      COMMON_FIELDS.map((f) => ({
        label: f.label,
        insertText: `${f.label} `,
        detail: f.detail,
        type: f.type,
      })),
      ""
    );
  }

  const lastToken = tokens[tokens.length - 1];
  const secondLastToken = tokens.length >= 2 ? tokens[tokens.length - 2] : undefined;

  // 1. If currently typing ORDER BY
  if (lastToken.type === "KEYWORD" && lastToken.value === "ORDER") {
    return [{ label: "BY", insertText: "BY ", detail: "Order by field", type: "keyword" }];
  }

  if (
    (lastToken.type === "KEYWORD" && lastToken.value === "BY") ||
    (lastToken.type === "COMMA" && isInOrderBy(tokens))
  ) {
    const sortFields = ["created", "updated", "dueDate", "priority", "key", "summary", "storyPoints"];
    return sortFields.map((sf) => ({
      label: sf,
      insertText: `${sf} DESC`,
      detail: "Sort field",
      type: "field",
    }));
  }

  // 2. Right after a sort field in ORDER BY
  if (isInOrderBy(tokens) && lastToken.type === "IDENTIFIER") {
    return [
      { label: "DESC", insertText: "DESC", detail: "Descending order", type: "keyword" },
      { label: "ASC", insertText: "ASC", detail: "Ascending order", type: "keyword" },
    ];
  }

  // 3. Right after a field name: Suggest Operators
  const isFieldToken = (t: TQLToken) =>
    t.type === "IDENTIFIER" &&
    COMMON_FIELDS.some((f) => f.label.toLowerCase() === t.value.toLowerCase());

  if (
    isFieldToken(lastToken) &&
    (!secondLastToken || secondLastToken.type === "KEYWORD" || secondLastToken.type === "LPAREN")
  ) {
    const f = lastToken.value.toLowerCase();
    if (f === "summary" || f === "description" || f === "text") {
      return TEXT_OPERATORS.map((op) => ({
        label: op.label,
        insertText: `${op.label} `,
        detail: op.detail,
        type: "operator",
      }));
    }
    if (f === "priority" || f === "storypoints" || f === "created" || f === "updated" || f === "duedate") {
      return COMPARISON_OPERATORS.map((op) => ({
        label: op.label,
        insertText: `${op.label} `,
        detail: op.detail,
        type: "operator",
      }));
    }
    return STANDARD_OPERATORS.map((op) => ({
      label: op.label,
      insertText: `${op.label} `,
      detail: op.detail,
      type: "operator",
    }));
  }

  // 4. Right after an operator: Suggest Values & Functions
  if (lastToken.type === "OPERATOR" || (lastToken.type === "KEYWORD" && (lastToken.value === "IN" || lastToken.value === "IS"))) {
    const targetFieldToken = findPrecedingField(tokens);
    const field = targetFieldToken ? targetFieldToken.value.toLowerCase() : "";

    // Operator is "IS"
    if (lastToken.value === "IS") {
      return [
        { label: "EMPTY", insertText: "EMPTY ", detail: "Field is empty or null", type: "keyword" },
        { label: "not EMPTY", insertText: "not EMPTY ", detail: "Field has a value", type: "keyword" },
      ];
    }

    return getFieldValues(field, context);
  }

  // 5. After a complete predicate: Suggest AND, OR, ORDER BY
  if (
    lastToken.type === "STRING" ||
    lastToken.type === "NUMBER" ||
    lastToken.type === "RPAREN" ||
    (lastToken.type === "IDENTIFIER" && !isFieldToken(lastToken)) ||
    (lastToken.type === "KEYWORD" && (lastToken.value === "EMPTY" || lastToken.value === "NULL" || lastToken.value === "DESC" || lastToken.value === "ASC"))
  ) {
    const currentWord = getCurrentWord(textBefore);
    return filterSuggestions(
      [
        { label: "AND", insertText: "AND ", detail: "Logical AND", type: "keyword" },
        { label: "OR", insertText: "OR ", detail: "Logical OR", type: "keyword" },
        { label: "ORDER BY", insertText: "ORDER BY ", detail: "Sort results", type: "keyword" },
      ],
      currentWord
    );
  }

  return [];
}

function getFieldValues(field: string, context: TQLAutocompleteContext): TQLSuggestion[] {
  if (field === "assignee" || field === "reporter") {
    const suggestions: TQLSuggestion[] = [
      { label: "currentUser()", insertText: "currentUser() ", detail: "Currently logged in user", type: "function" },
    ];
    if (context.users) {
      for (const u of context.users) {
        suggestions.push({
          label: `"${u.name}"`,
          insertText: `"${u.name}" `,
          detail: u.email || "User",
          type: "value",
        });
      }
    }
    return suggestions;
  }

  if (field === "project" || field === "projectkey") {
    if (context.projects) {
      return context.projects.map((p) => ({
        label: p.key,
        insertText: `"${p.key}" `,
        detail: p.name,
        type: "value",
      }));
    }
  }

  if (field === "type" || field === "issuetype") {
    const types = ["Bug", "Story", "Task", "Epic", "Subtask"];
    return types.map((t) => ({
      label: t,
      insertText: `${t} `,
      detail: "Issue type",
      type: "value",
    }));
  }

  if (field === "status") {
    const defaultStatuses = context.statuses || ["TODO", "In Progress", "In Review", "Done"];
    return defaultStatuses.map((s) => ({
      label: `"${s}"`,
      insertText: `"${s}" `,
      detail: "Workflow status",
      type: "value",
    }));
  }

  if (field === "statuscategory" || field === "category") {
    return [
      { label: "TODO", insertText: "TODO ", detail: "Not started / Backlog", type: "value" },
      { label: "IN_PROGRESS", insertText: "IN_PROGRESS ", detail: "Work in progress", type: "value" },
      { label: "DONE", insertText: "DONE ", detail: "Completed / Resolved", type: "value" },
    ];
  }

  if (field === "priority") {
    const priorities = ["Highest", "High", "Medium", "Low", "Lowest"];
    return priorities.map((p) => ({
      label: p,
      insertText: `${p} `,
      detail: "Priority level",
      type: "value",
    }));
  }

  if (field === "sprint") {
    const suggestions: TQLSuggestion[] = [
      { label: "openSprints()", insertText: "openSprints() ", detail: "Currently active sprints", type: "function" },
    ];
    if (context.sprints) {
      for (const s of context.sprints) {
        suggestions.push({
          label: `"${s}"`,
          insertText: `"${s}" `,
          detail: "Sprint name",
          type: "value",
        });
      }
    }
    return suggestions;
  }

  if (field === "fixversion" || field === "version") {
    const suggestions: TQLSuggestion[] = [
      { label: "unreleasedVersions()", insertText: "unreleasedVersions() ", detail: "Versions not yet released", type: "function" },
    ];
    if (context.versions) {
      for (const v of context.versions) {
        suggestions.push({
          label: `"${v}"`,
          insertText: `"${v}" `,
          detail: "Release version",
          type: "value",
        });
      }
    }
    return suggestions;
  }

  if (field === "created" || field === "updated" || field === "duedate") {
    return [
      { label: "-7d", insertText: "-7d ", detail: "Last 7 days", type: "value" },
      { label: "-24h", insertText: "-24h ", detail: "Last 24 hours", type: "value" },
      { label: "-2w", insertText: "-2w ", detail: "Last 2 weeks", type: "value" },
      { label: "-30d", insertText: "-30d ", detail: "Last 30 days", type: "value" },
      { label: "now()", insertText: "now() ", detail: "Current timestamp", type: "function" },
      { label: "startOfDay()", insertText: "startOfDay() ", detail: "Midnight today", type: "function" },
      { label: "endOfDay()", insertText: "endOfDay() ", detail: "End of today", type: "function" },
    ];
  }

  if (field === "labels" || field === "label") {
    if (context.labels) {
      return context.labels.map((l) => ({
        label: `"${l}"`,
        insertText: `"${l}" `,
        detail: "Label tag",
        type: "value",
      }));
    }
  }

  if (field === "component" || field === "components") {
    if (context.components) {
      return context.components.map((c) => ({
        label: `"${c}"`,
        insertText: `"${c}" `,
        detail: "Component",
        type: "value",
      }));
    }
  }

  return [];
}

function findPrecedingField(tokens: TQLToken[]): TQLToken | undefined {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === "IDENTIFIER") {
      return t;
    }
    if (t.type === "KEYWORD" && (t.value === "AND" || t.value === "OR")) {
      break;
    }
  }
  return undefined;
}

function isInOrderBy(tokens: TQLToken[]): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === "KEYWORD" && tokens[i].value === "ORDER") {
      return true;
    }
  }
  return false;
}

function getCurrentWord(text: string): string {
  const match = text.match(/([a-zA-Z0-9_]+)$/);
  return match ? match[1] : "";
}

function filterSuggestions(suggestions: TQLSuggestion[], query: string): TQLSuggestion[] {
  if (!query) return suggestions;
  const q = query.toLowerCase();
  return suggestions.filter(
    (s) => s.label.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)
  );
}
