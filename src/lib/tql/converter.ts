import { TQLParser } from "./parser";
import { TQLNode, TQLPredicateNode, TQLQuery } from "./ast";

export interface BasicFilterState {
  projectKey?: string;
  type?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  assigneeName?: string;
  reporterId?: string;
  sprintId?: string;
  sprintName?: string;
  versionId?: string;
  versionName?: string;
  label?: string;
  search?: string;
  preset?: string;
  currentUserId?: string | null;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export function basicFiltersToTQL(filters: BasicFilterState): string {
  const clauses: string[] = [];

  // Project
  if (filters.projectKey && filters.projectKey !== "ALL") {
    clauses.push(`project = "${escapeString(filters.projectKey)}"`);
  }

  // Preset
  if (filters.preset === "MY_OPEN") {
    clauses.push("assignee = currentUser() AND statusCategory != Done");
  } else if (filters.preset === "REPORTED_BY_ME") {
    clauses.push("reporter = currentUser()");
  } else if (filters.preset === "DONE") {
    clauses.push("statusCategory = Done");
  } else if (filters.preset === "HIGH_PRIORITY") {
    clauses.push("priority in (High, Highest)");
  } else if (filters.preset === "RECENTLY_UPDATED") {
    clauses.push("updated >= -7d");
  }

  // Type
  if (filters.type && filters.type !== "ALL") {
    clauses.push(`type = "${escapeString(filters.type)}"`);
  }

  // Status
  if (filters.status && filters.status !== "ALL") {
    clauses.push(`status = "${escapeString(filters.status)}"`);
  }

  // Priority
  if (filters.priority && filters.priority !== "ALL") {
    clauses.push(`priority = "${escapeString(filters.priority)}"`);
  }

  // Assignee
  if (filters.assigneeId && filters.assigneeId !== "ALL") {
    if (filters.assigneeId === "UNASSIGNED") {
      clauses.push("assignee is EMPTY");
    } else if (filters.currentUserId && filters.assigneeId === filters.currentUserId) {
      clauses.push("assignee = currentUser()");
    } else {
      const val = filters.assigneeName || filters.assigneeId;
      clauses.push(`assignee = "${escapeString(val)}"`);
    }
  }

  // Reporter
  if (filters.reporterId && filters.reporterId !== "ALL") {
    if (filters.currentUserId && filters.reporterId === filters.currentUserId) {
      clauses.push("reporter = currentUser()");
    } else {
      clauses.push(`reporter = "${escapeString(filters.reporterId)}"`);
    }
  }

  // Sprint
  if (filters.sprintId && filters.sprintId !== "ALL") {
    if (filters.sprintId === "BACKLOG") {
      clauses.push("sprint is EMPTY");
    } else {
      const val = filters.sprintName || filters.sprintId;
      clauses.push(`sprint = "${escapeString(val)}"`);
    }
  }

  // Version
  if (filters.versionId && filters.versionId !== "ALL") {
    if (filters.versionId === "UNASSIGNED") {
      clauses.push("fixVersion is EMPTY");
    } else {
      const val = filters.versionName || filters.versionId;
      clauses.push(`fixVersion = "${escapeString(val)}"`);
    }
  }

  // Label
  if (filters.label && filters.label !== "ALL") {
    clauses.push(`labels = "${escapeString(filters.label)}"`);
  }

  // Search text
  if (filters.search && filters.search.trim()) {
    clauses.push(`text ~ "${escapeString(filters.search.trim())}"`);
  }

  // Order By
  let orderClause = "";
  if (filters.sortField) {
    const dir = (filters.sortOrder || "desc").toUpperCase();
    orderClause = `ORDER BY ${filters.sortField} ${dir}`;
  }

  const wherePart = clauses.join(" AND ");
  if (wherePart && orderClause) {
    return `${wherePart} ${orderClause}`;
  }
  if (wherePart) {
    return wherePart;
  }
  return orderClause;
}

export type TQLConversionResult =
  | { convertible: true; state: Partial<BasicFilterState> }
  | { convertible: false; reason: string };

export function tqlToBasicFilters(queryStr: string): TQLConversionResult {
  const parseRes = TQLParser.parse(queryStr);
  if (!parseRes.success) {
    return { convertible: false, reason: "Query has syntax errors." };
  }

  const { where, orderBy } = parseRes.query;
  const state: Partial<BasicFilterState> = {};

  if (orderBy.length > 0) {
    state.sortField = orderBy[0].field;
    state.sortOrder = orderBy[0].direction.toLowerCase() as "asc" | "desc";
  }

  if (!where) {
    return { convertible: true, state };
  }

  // Flatten top-level AND predicates
  const predicates: TQLPredicateNode[] = [];
  const queue: TQLNode[] = [where];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.type === "AND") {
      queue.push(node.left);
      queue.push(node.right);
    } else if (node.type === "PREDICATE") {
      predicates.push(node);
    } else {
      // Contains OR or NOT - cannot be represented in basic filters
      return {
        convertible: false,
        reason: "Query contains OR or NOT grouping which requires JQL mode.",
      };
    }
  }

  for (const p of predicates) {
    const f = p.field.toLowerCase();
    const strVal = p.value.type === "STRING" ? p.value.value : undefined;

    if (f === "project" && p.operator === "=" && strVal) {
      state.projectKey = strVal;
    } else if ((f === "type" || f === "issuetype") && p.operator === "=" && strVal) {
      state.type = strVal.toUpperCase();
    } else if (f === "status" && p.operator === "=" && strVal) {
      state.status = strVal;
    } else if (f === "priority" && p.operator === "=" && strVal) {
      state.priority = strVal.toUpperCase();
    } else if (f === "assignee") {
      if (p.operator === "IS EMPTY") {
        state.assigneeId = "UNASSIGNED";
      } else if (p.value.type === "FUNCTION" && p.value.name.toLowerCase() === "currentuser") {
        state.assigneeId = "CURRENT_USER";
      } else if (p.operator === "=" && strVal) {
        state.assigneeId = strVal;
      }
    } else if (f === "sprint") {
      if (p.operator === "IS EMPTY") {
        state.sprintId = "BACKLOG";
      } else if (p.operator === "=" && strVal) {
        state.sprintId = strVal;
      }
    } else if (f === "version" || f === "fixversion") {
      if (p.operator === "IS EMPTY") {
        state.versionId = "UNASSIGNED";
      } else if (p.operator === "=" && strVal) {
        state.versionId = strVal;
      }
    } else if ((f === "labels" || f === "label") && p.operator === "=" && strVal) {
      state.label = strVal;
    } else if (f === "text" && p.operator === "~" && strVal) {
      state.search = strVal;
    } else {
      // Unmapped predicate, e.g. function or relative date
      return {
        convertible: false,
        reason: `Filter on '${p.field}' with operator '${p.operator}' requires JQL mode.`,
      };
    }
  }

  return { convertible: true, state };
}

function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
