/**
 * The Issues page's query. Everything comes down to TQL: the filter chips
 * write it, saved and built-in views store it, and the server runs it. Going
 * the other way, a query is read back into chips, and whatever the chips
 * can't show is kept as TQL conditions of its own, so nothing is lost.
 */
import type { TQLNode, TQLPredicateNode, TQLValue } from "@/lib/tql/ast";
import { TQLParser } from "@/lib/tql/parser";

export type ChipField = "type" | "status" | "priority" | "assignee" | "reporter" | "sprint" | "version" | "label";

/** Special chip values alongside ids and names. */
export const ME = "@me";
export const NONE = "@none";
export const OPEN_SPRINTS = "@open";

export interface IssueFilters {
  /** Upper-case key, or null for every project you can see. */
  projectKey: string | null;
  text: string;
  type: string[];
  status: string[];
  priority: string[];
  /** User ids, or ME / NONE. */
  assignee: string[];
  /** User ids, or ME. */
  reporter: string[];
  /** Sprint names, or NONE (the backlog) / OPEN_SPRINTS. */
  sprint: string[];
  /** Version names, or NONE. */
  version: string[];
  label: string[];
  /** Conditions the chips can't show, as TQL; all must hold. */
  extra: string[];
}

export type SortField = "key" | "title" | "type" | "status" | "priority" | "points" | "created" | "updated" | "duedate";

export interface IssueSort {
  field: SortField;
  direction: "ASC" | "DESC";
}

export interface IssueQuery {
  filters: IssueFilters;
  sort: IssueSort;
}

export const DEFAULT_SORT: IssueSort = { field: "created", direction: "DESC" };

export function emptyFilters(projectKey: string | null): IssueFilters {
  return { projectKey, text: "", type: [], status: [], priority: [], assignee: [], reporter: [], sprint: [], version: [], label: [], extra: [] };
}

export const CHIP_FIELDS: ChipField[] = ["type", "status", "priority", "assignee", "reporter", "sprint", "version", "label"];

/** How many chips (and conditions) narrow the list, not counting the project. */
export function activeFilterCount(f: IssueFilters): number {
  return CHIP_FIELDS.filter((k) => f[k].length > 0).length + (f.text.trim() ? 1 : 0) + f.extra.length;
}

// ---- Printing TQL -------------------------------------------------------------

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const RELATIVE = /^[+-]?\d+[a-z]+$/i;

export function printValue(v: TQLValue): string {
  switch (v.type) {
    case "STRING":
      return RELATIVE.test(v.value) ? v.value : quote(v.value);
    case "NUMBER":
      return String(v.value);
    case "FUNCTION":
      return `${v.name}(${v.args.map(printValue).join(", ")})`;
    case "LIST":
      return `(${v.values.map(printValue).join(", ")})`;
    case "EMPTY":
      return "EMPTY";
  }
}

/** A condition as TQL text, parenthesized where precedence needs it. */
export function printNode(node: TQLNode, parent?: "AND" | "OR" | "NOT"): string {
  if (node.type === "PREDICATE") {
    if (node.operator === "IS EMPTY" || node.operator === "IS NOT EMPTY") return `${node.field} ${node.operator.toLowerCase().replace("empty", "EMPTY")}`;
    return `${node.field} ${node.operator === "IN" || node.operator === "NOT IN" ? node.operator.toLowerCase() : node.operator} ${printValue(node.value)}`;
  }
  if (node.type === "NOT") return `NOT ${printNode(node.child, "NOT")}`;
  const text = `${printNode(node.left, node.type)} ${node.type} ${printNode(node.right, node.type)}`;
  return parent && parent !== node.type ? `(${text})` : text;
}

// ---- Chips -> TQL ----------------------------------------------------------------

const TQL_FIELD: Record<ChipField, string> = {
  type: "type",
  status: "status",
  priority: "priority",
  assignee: "assignee",
  reporter: "reporter",
  sprint: "sprint",
  version: "fixVersion",
  label: "labels",
};

function inOrEquals(field: string, values: string[]): string {
  return values.length === 1 ? `${field} = ${quote(values[0])}` : `${field} in (${values.map(quote).join(", ")})`;
}

/** One chip as a TQL condition: its values are alternatives (OR). */
export function chipToTQL(field: ChipField, values: string[]): string | null {
  if (!values.length) return null;
  const name = TQL_FIELD[field];
  const parts: string[] = [];
  const plain = values.filter((v) => v !== ME && v !== NONE && v !== OPEN_SPRINTS);
  if (values.includes(ME)) parts.push(`${name} = currentUser()`);
  if (values.includes(OPEN_SPRINTS)) parts.push(`${name} in openSprints()`);
  if (plain.length) parts.push(inOrEquals(name, plain));
  if (values.includes(NONE)) parts.push(`${name} is EMPTY`);
  return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0];
}

export function filtersToTQL(f: IssueFilters): string {
  const clauses: string[] = [];
  if (f.projectKey) clauses.push(`project = ${quote(f.projectKey)}`);
  for (const field of CHIP_FIELDS) {
    const clause = chipToTQL(field, f[field]);
    if (clause) clauses.push(clause);
  }
  if (f.text.trim()) clauses.push(`text ~ ${quote(f.text.trim())}`);
  for (const extra of f.extra) clauses.push(/\bOR\b/i.test(extra) && !/^\(.*\)$/.test(extra) ? `(${extra})` : extra);
  return clauses.join(" AND ");
}

export function queryToTQL(q: IssueQuery): string {
  const where = filtersToTQL(q.filters);
  const order = `ORDER BY ${q.sort.field} ${q.sort.direction}`;
  return where ? `${where} ${order}` : order;
}

// ---- TQL -> chips ---------------------------------------------------------------

const FIELD_ALIASES: Record<string, ChipField | "project" | "text"> = {
  type: "type",
  issuetype: "type",
  status: "status",
  priority: "priority",
  assignee: "assignee",
  reporter: "reporter",
  sprint: "sprint",
  version: "version",
  fixversion: "version",
  label: "label",
  labels: "label",
  project: "project",
  projectkey: "project",
  text: "text",
};

const SORT_ALIASES: Record<string, SortField> = {
  key: "key",
  issuekey: "key",
  summary: "title",
  title: "title",
  type: "type",
  issuetype: "type",
  status: "status",
  priority: "priority",
  storypoints: "points",
  points: "points",
  created: "created",
  createdat: "created",
  updated: "updated",
  updatedat: "updated",
  duedate: "duedate",
};

const upperFields = new Set<ChipField>(["type", "priority"]);

/** The chip values one predicate stands for, or null if a chip can't show it. */
function predicateValues(field: ChipField, p: TQLPredicateNode): string[] | null {
  const fn = (v: TQLValue, name: string) => v.type === "FUNCTION" && v.name.toLowerCase() === name.toLowerCase();
  if (p.operator === "IS EMPTY" || p.value.type === "EMPTY") {
    return field === "assignee" || field === "sprint" || field === "version" ? [NONE] : null;
  }
  if (p.operator !== "=" && p.operator !== "IN") return null;
  if ((field === "assignee" || field === "reporter") && fn(p.value, "currentUser")) return [ME];
  if (field === "sprint" && (fn(p.value, "openSprints") || (p.value.type === "LIST" && p.value.values.length === 1 && fn(p.value.values[0], "openSprints")))) {
    return [OPEN_SPRINTS];
  }
  const values = p.value.type === "LIST" ? p.value.values : [p.value];
  if (!values.every((v) => v.type === "STRING")) return null;
  return values.map((v) => {
    const s = (v as { value: string }).value;
    return upperFields.has(field) ? s.toUpperCase() : s;
  });
}

/** The chip a whole condition maps onto: one predicate, or an OR of predicates on the same field. */
function nodeAsChip(node: TQLNode): { field: ChipField; values: string[] } | null {
  if (node.type === "PREDICATE") {
    const alias = FIELD_ALIASES[node.field.toLowerCase()];
    if (!alias || alias === "project" || alias === "text") return null;
    const values = predicateValues(alias, node);
    return values ? { field: alias, values } : null;
  }
  if (node.type === "OR") {
    const left = nodeAsChip(node.left);
    const right = nodeAsChip(node.right);
    if (left && right && left.field === right.field) return { field: left.field, values: [...new Set([...left.values, ...right.values])] };
  }
  return null;
}

function andTerms(node: TQLNode | undefined): TQLNode[] {
  if (!node) return [];
  return node.type === "AND" ? [...andTerms(node.left), ...andTerms(node.right)] : [node];
}

export type ParsedQuery = { ok: true; query: IssueQuery } | { ok: false; error: string };

/**
 * Reads a TQL query into chips and a sort. Conditions a chip can't show
 * (OR across fields, comparisons, a second condition on the same field) are
 * kept as TQL in `extra`.
 */
export function tqlToQuery(tql: string): ParsedQuery {
  const parsed = TQLParser.parse(tql);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const filters = emptyFilters(null);
  for (const term of andTerms(parsed.query.where)) {
    if (term.type === "PREDICATE") {
      const alias = FIELD_ALIASES[term.field.toLowerCase()];
      if (alias === "project" && term.operator === "=" && term.value.type === "STRING" && !filters.projectKey) {
        filters.projectKey = term.value.value.toUpperCase();
        continue;
      }
      if (alias === "text" && term.operator === "~" && term.value.type === "STRING" && !filters.text) {
        filters.text = term.value.value;
        continue;
      }
    }
    const chip = nodeAsChip(term);
    if (chip && filters[chip.field].length === 0) {
      filters[chip.field] = chip.values;
    } else {
      // Each kept condition stands alone, so an OR brings its own parentheses.
      filters.extra.push(term.type === "OR" ? `(${printNode(term)})` : printNode(term));
    }
  }
  const first = parsed.query.orderBy[0];
  const field = first ? SORT_ALIASES[first.field.toLowerCase()] : undefined;
  const sort: IssueSort = field ? { field, direction: first.direction } : DEFAULT_SORT;
  return { ok: true, query: { filters, sort } };
}

// ---- Views ------------------------------------------------------------------------

export type ColumnId =
  | "type"
  | "key"
  | "title"
  | "status"
  | "priority"
  | "points"
  | "assignee"
  | "reporter"
  | "sprint"
  | "version"
  | "labels"
  | "due"
  | "created"
  | "updated";

export const COLUMNS: { id: ColumnId; label: string; sort?: SortField; required?: boolean }[] = [
  { id: "type", label: "Type", sort: "type" },
  { id: "key", label: "Key", sort: "key", required: true },
  { id: "title", label: "Summary", sort: "title", required: true },
  { id: "status", label: "Status", sort: "status" },
  // Sorted by rank on the server (src/lib/prioritySort.ts), not as text.
  { id: "priority", label: "Priority", sort: "priority" },
  { id: "points", label: "Points", sort: "points" },
  { id: "assignee", label: "Assignee" },
  { id: "reporter", label: "Reporter" },
  { id: "sprint", label: "Sprint" },
  { id: "version", label: "Fix version" },
  { id: "labels", label: "Labels" },
  { id: "due", label: "Due", sort: "duedate" },
  { id: "created", label: "Created", sort: "created" },
  { id: "updated", label: "Updated", sort: "updated" },
];

export const DEFAULT_COLUMNS: ColumnId[] = ["type", "key", "title", "status", "priority", "points", "assignee", "due", "updated"];

/** Keeps known columns in their standard order, always with key and summary. */
export function normalizeColumns(columns: readonly string[] | null | undefined): ColumnId[] {
  const wanted = new Set(columns && columns.length ? columns : DEFAULT_COLUMNS);
  return COLUMNS.filter((c) => c.required || wanted.has(c.id)).map((c) => c.id);
}

export interface ViewDefinition {
  id: string;
  name: string;
  /** TQL without the project: a view works in any project. */
  tql: string;
  columns: ColumnId[];
  builtIn?: boolean;
}

/** The six presets the Issues page always had, as views. */
export const BUILT_IN_VIEWS: ViewDefinition[] = [
  { id: "preset-all", name: "All issues", tql: "ORDER BY created DESC", columns: DEFAULT_COLUMNS, builtIn: true },
  {
    id: "preset-my-open",
    name: "My open issues",
    tql: "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
    columns: DEFAULT_COLUMNS,
    builtIn: true,
  },
  { id: "preset-reported", name: "Reported by me", tql: "reporter = currentUser() ORDER BY created DESC", columns: DEFAULT_COLUMNS, builtIn: true },
  { id: "preset-recent", name: "Recently updated", tql: "updated >= -7d ORDER BY updated DESC", columns: DEFAULT_COLUMNS, builtIn: true },
  { id: "preset-done", name: "Done", tql: "statusCategory = Done ORDER BY updated DESC", columns: DEFAULT_COLUMNS, builtIn: true },
  {
    id: "preset-high",
    name: "High priority",
    tql: 'priority in ("HIGHEST", "HIGH") ORDER BY priority DESC',
    columns: DEFAULT_COLUMNS,
    builtIn: true,
  },
];

/** A view's query in a given project (null: every project). */
export function viewQuery(view: ViewDefinition, projectKey: string | null): IssueQuery {
  const parsed = tqlToQuery(view.tql);
  const query = parsed.ok ? parsed.query : { filters: emptyFilters(null), sort: DEFAULT_SORT };
  return { ...query, filters: { ...query.filters, projectKey } };
}

/** What a view stores: the query without its project. */
export function queryForView(q: IssueQuery): string {
  return queryToTQL({ ...q, filters: { ...q.filters, projectKey: null } });
}

/** Whether the page still shows exactly what the view defines. */
export function matchesView(view: ViewDefinition, q: IssueQuery, columns: ColumnId[]): boolean {
  const fromView = viewQuery(view, q.filters.projectKey);
  return queryToTQL(fromView) === queryToTQL(q) && normalizeColumns(view.columns).join() === normalizeColumns(columns).join();
}

// ---- Words for the "extra" conditions ---------------------------------------------

const KNOWN_EXTRAS: Record<string, string> = {
  "statusCategory != \"Done\"": "Not done",
  "statusCategory = \"Done\"": "Done",
  "updated >= -7d": "Updated in the last 7 days",
};

/** A short label for a condition the chips can't show. */
export function describeExtra(tql: string): string {
  return KNOWN_EXTRAS[tql] ?? tql;
}
