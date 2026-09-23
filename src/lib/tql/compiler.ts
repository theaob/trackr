import {
  TQLNode,
  TQLQuery,
  TQLPredicateNode,
  TQLValue,
  TQLOrderBy,
} from "./ast";

export interface TQLCompilerContext {
  currentUserId?: string | null;
  accessibleProjectIds?: string[];
  activeSprintIds?: string[];
  unreleasedVersionIds?: string[];
  /**
   * Projects in which assignee/reporter may be matched by email. Anywhere
   * else only id and name match, so a query can't test whether someone in a
   * published project has a given email. Leave undefined for server-side
   * filters that aren't run on a user's behalf (webhooks).
   */
  emailMatchProjectIds?: string[];
}

export interface TQLCompiledQuery {
  where: Record<string, any>;
  orderBy: Record<string, "asc" | "desc">[];
}

const PRIORITY_ORDER = ["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"];

export class TQLCompiler {
  private context: TQLCompilerContext;

  constructor(context: TQLCompilerContext = {}) {
    this.context = context;
  }

  /** An email condition, confined to the projects where matching by email is allowed. */
  private whereEmailMayMatch(condition: Record<string, any>): Record<string, any> {
    const ids = this.context.emailMatchProjectIds;
    if (ids === undefined) return condition;
    return { AND: [{ projectId: { in: ids } }, condition] };
  }

  public compile(query: TQLQuery): TQLCompiledQuery {
    const where: Record<string, any> = {};

    // Security boundary: Restrict to accessible projects
    if (this.context.accessibleProjectIds) {
      where.projectId = { in: this.context.accessibleProjectIds };
    }

    if (query.where) {
      const astWhere = this.compileNode(query.where);
      if (astWhere) {
        if (where.projectId) {
          where.AND = [astWhere];
        } else {
          Object.assign(where, astWhere);
        }
      }
    }

    const orderBy: Record<string, "asc" | "desc">[] = [];
    for (const item of query.orderBy) {
      const field = this.mapSortField(item.field);
      if (field) {
        orderBy.push({
          [field]: item.direction.toLowerCase() as "asc" | "desc",
        });
      }
    }

    return { where, orderBy };
  }

  private compileNode(node: TQLNode): any {
    switch (node.type) {
      case "AND": {
        const left = this.compileNode(node.left);
        const right = this.compileNode(node.right);
        if (!left) return right;
        if (!right) return left;
        return { AND: [left, right] };
      }
      case "OR": {
        const left = this.compileNode(node.left);
        const right = this.compileNode(node.right);
        if (!left) return right;
        if (!right) return left;
        return { OR: [left, right] };
      }
      case "NOT": {
        const child = this.compileNode(node.child);
        return child ? { NOT: child } : {};
      }
      case "PREDICATE":
        return this.compilePredicate(node);
      default:
        return {};
    }
  }

  private compilePredicate(node: TQLPredicateNode): any {
    const field = node.field.toLowerCase();
    const op = node.operator;
    const val = node.value;

    // 1. PROJECT
    if (field === "project" || field === "projectkey") {
      const strValues = this.extractStrings(val).map((s) => s.toUpperCase());
      if (op === "=" || op === "IN") {
        if (strValues.length === 1) {
          return {
            project: {
              OR: [{ key: strValues[0] }, { name: strValues[0] }],
            },
          };
        }
        return {
          project: {
            OR: [
              { key: { in: strValues } },
              { name: { in: strValues } },
            ],
          },
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          project: {
            key: { notIn: strValues },
          },
        };
      }
    }

    // 2. ISSUE KEY / ID
    if (field === "key" || field === "issuekey" || field === "id") {
      const strValues = this.extractStrings(val).map((s) => s.toUpperCase());
      if (op === "=" || op === "IN") {
        return strValues.length === 1 ? { key: strValues[0] } : { key: { in: strValues } };
      }
      if (op === "!=" || op === "NOT IN") {
        return { key: { notIn: strValues } };
      }
    }

    // 3. ISSUE TYPE
    if (field === "type" || field === "issuetype") {
      const strValues = this.extractStrings(val).map((s) => s.toUpperCase());
      if (op === "=" || op === "IN") {
        return strValues.length === 1 ? { type: strValues[0] } : { type: { in: strValues } };
      }
      if (op === "!=" || op === "NOT IN") {
        return { type: { notIn: strValues } };
      }
    }

    // 4. STATUS
    if (field === "status") {
      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        return strValues.length === 1 ? { status: strValues[0] } : { status: { in: strValues } };
      }
      if (op === "!=" || op === "NOT IN") {
        return { status: { notIn: strValues } };
      }
    }

    // 5. STATUS CATEGORY
    if (field === "statuscategory" || field === "category") {
      const rawValues = this.extractStrings(val).map((s) => {
        const u = s.toUpperCase().replace(/\s+/g, "_");
        if (u === "TO_DO") return "TODO";
        return u;
      });
      // In Trackr, WorkflowStatusCategory is TODO, IN_PROGRESS, DONE
      // We can map default names
      const categoryToStatuses: Record<string, string[]> = {
        TODO: ["TODO", "Backlog", "To Do", "Open"],
        IN_PROGRESS: ["IN_PROGRESS", "In Progress", "In Review", "Review"],
        DONE: ["DONE", "Done", "Closed", "Resolved"],
      };

      let statuses: string[] = [];
      for (const cat of rawValues) {
        if (categoryToStatuses[cat]) {
          statuses.push(...categoryToStatuses[cat]);
        }
      }
      if (statuses.length === 0) statuses = rawValues;

      if (op === "=" || op === "IN") {
        return { status: { in: statuses } };
      }
      if (op === "!=" || op === "NOT IN") {
        return { status: { notIn: statuses } };
      }
    }

    // 6. PRIORITY
    if (field === "priority") {
      const strVal = this.extractSingleString(val)?.toUpperCase();
      if (strVal) {
        const idx = PRIORITY_ORDER.indexOf(strVal);
        if (idx !== -1) {
          if (op === ">=") {
            return { priority: { in: PRIORITY_ORDER.slice(idx) } };
          }
          if (op === ">") {
            return { priority: { in: PRIORITY_ORDER.slice(idx + 1) } };
          }
          if (op === "<=") {
            return { priority: { in: PRIORITY_ORDER.slice(0, idx + 1) } };
          }
          if (op === "<") {
            return { priority: { in: PRIORITY_ORDER.slice(0, idx) } };
          }
        }
      }
      const strValues = this.extractStrings(val).map((s) => s.toUpperCase());
      if (op === "=" || op === "IN") {
        return strValues.length === 1 ? { priority: strValues[0] } : { priority: { in: strValues } };
      }
      if (op === "!=" || op === "NOT IN") {
        return { priority: { notIn: strValues } };
      }
    }

    // 7. ASSIGNEE
    if (field === "assignee") {
      if (op === "IS NOT EMPTY") {
        return { assigneeId: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { assigneeId: null };
      }

      // Check for currentUser()
      if (val.type === "FUNCTION" && val.name.toLowerCase() === "currentuser") {
        const uid = this.context.currentUserId;
        if (op === "=") return { assigneeId: uid || "__NO_MATCH__" };
        if (op === "!=") return { assigneeId: { not: uid || "__NO_MATCH__" } };
      }

      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        if (strValues.length === 1) {
          const v = strValues[0];
          return {
            OR: [
              { assignee: { id: v } },
              { assignee: { name: { contains: v } } },
              this.whereEmailMayMatch({ assignee: { email: v } }),
            ],
          };
        }
        return {
          OR: [
            { assignee: { id: { in: strValues } } },
            this.whereEmailMayMatch({ assignee: { email: { in: strValues } } }),
          ],
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          assignee: {
            id: { notIn: strValues },
          },
        };
      }
    }

    // 8. REPORTER
    if (field === "reporter") {
      if (op === "IS NOT EMPTY") {
        return { reporterId: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { reporterId: null };
      }

      if (val.type === "FUNCTION" && val.name.toLowerCase() === "currentuser") {
        const uid = this.context.currentUserId;
        if (op === "=") return { reporterId: uid || "__NO_MATCH__" };
        if (op === "!=") return { reporterId: { not: uid || "__NO_MATCH__" } };
      }

      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        if (strValues.length === 1) {
          const v = strValues[0];
          return {
            OR: [
              { reporter: { id: v } },
              { reporter: { name: { contains: v } } },
              this.whereEmailMayMatch({ reporter: { email: v } }),
            ],
          };
        }
        return {
          OR: [
            { reporter: { id: { in: strValues } } },
            this.whereEmailMayMatch({ reporter: { email: { in: strValues } } }),
          ],
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          reporter: {
            id: { notIn: strValues },
          },
        };
      }
    }

    // 9. SPRINT
    if (field === "sprint") {
      if (op === "IS NOT EMPTY") {
        return { sprintId: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { sprintId: null };
      }

      // Check openSprints() or activeSprint()
      const isOpenSprintsFunc = (v: TQLValue) =>
        v.type === "FUNCTION" &&
        (v.name.toLowerCase() === "opensprints" || v.name.toLowerCase() === "activesprint");

      if (isOpenSprintsFunc(val) || (val.type === "LIST" && val.values.some(isOpenSprintsFunc))) {
        const sprintIds = this.context.activeSprintIds || [];
        if (op === "=" || op === "IN") {
          return { sprintId: { in: sprintIds } };
        }
        if (op === "!=" || op === "NOT IN") {
          return { sprintId: { notIn: sprintIds } };
        }
      }

      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        return {
          sprint: {
            OR: [{ id: { in: strValues } }, { name: { in: strValues } }],
          },
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          sprint: {
            name: { notIn: strValues },
          },
        };
      }
    }

    // 10. VERSION / FIXVERSION
    if (field === "version" || field === "fixversion") {
      if (op === "IS NOT EMPTY") {
        return { versionId: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { versionId: null };
      }

      const isUnreleasedFunc = (v: TQLValue) =>
        v.type === "FUNCTION" && v.name.toLowerCase() === "unreleasedversions";

      if (isUnreleasedFunc(val) || (val.type === "LIST" && val.values.some(isUnreleasedFunc))) {
        const vids = this.context.unreleasedVersionIds || [];
        if (op === "=" || op === "IN") return { versionId: { in: vids } };
        if (op === "!=" || op === "NOT IN") return { versionId: { notIn: vids } };
      }

      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        return {
          version: {
            OR: [{ id: { in: strValues } }, { name: { in: strValues } }],
          },
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          version: {
            name: { notIn: strValues },
          },
        };
      }
    }

    // 11. PARENT / EPIC
    if (field === "parent" || field === "epic") {
      if (op === "IS NOT EMPTY") {
        return { parentId: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { parentId: null };
      }
      const strValues = this.extractStrings(val).map((s) => s.toUpperCase());
      return {
        parent: {
          key: { in: strValues },
        },
      };
    }

    // 12. LABELS / LABEL
    if (field === "labels" || field === "label") {
      if (op === "IS NOT EMPTY") {
        return { labels: { some: {} } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { labels: { none: {} } };
      }
      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        return {
          labels: {
            some: {
              label: {
                name: { in: strValues },
              },
            },
          },
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          labels: {
            none: {
              label: {
                name: { in: strValues },
              },
            },
          },
        };
      }
    }

    // 13. COMPONENT / COMPONENTS
    if (field === "component" || field === "components") {
      if (op === "IS NOT EMPTY") {
        return { components: { some: {} } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { components: { none: {} } };
      }
      const strValues = this.extractStrings(val);
      if (op === "=" || op === "IN") {
        return {
          components: {
            some: {
              component: {
                name: { in: strValues },
              },
            },
          },
        };
      }
      if (op === "!=" || op === "NOT IN") {
        return {
          components: {
            none: {
              component: {
                name: { in: strValues },
              },
            },
          },
        };
      }
    }

    // 14. STORY POINTS
    if (field === "storypoints" || field === "points") {
      if (op === "IS NOT EMPTY") {
        return { storyPoints: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { storyPoints: null };
      }
      const num = this.extractNumber(val);
      if (num !== null) {
        if (op === "=") return { storyPoints: num };
        if (op === "!=") return { storyPoints: { not: num } };
        if (op === ">=") return { storyPoints: { gte: num } };
        if (op === ">") return { storyPoints: { gt: num } };
        if (op === "<=") return { storyPoints: { lte: num } };
        if (op === "<") return { storyPoints: { lt: num } };
      }
    }

    // 15. DATES: created, updated, duedate
    if (field === "created" || field === "createdat" || field === "updated" || field === "updatedat" || field === "duedate") {
      const dbField = field.startsWith("create") ? "createdAt" : field.startsWith("update") ? "updatedAt" : "dueDate";
      if (op === "IS NOT EMPTY") {
        return { [dbField]: { not: null } };
      }
      if (op === "IS EMPTY" || val.type === "EMPTY") {
        return { [dbField]: null };
      }

      const date = this.parseDateValue(val);
      if (date) {
        if (op === ">=") return { [dbField]: { gte: date } };
        if (op === ">") return { [dbField]: { gt: date } };
        if (op === "<=") return { [dbField]: { lte: date } };
        if (op === "<") return { [dbField]: { lt: date } };
        if (op === "=") return { [dbField]: date };
        if (op === "!=") return { [dbField]: { not: date } };
      }
    }

    // 16. TEXT SEARCH: summary, description, text
    if (field === "summary" || field === "title") {
      const str = this.extractSingleString(val);
      if (str) {
        if (op === "~") return { title: { contains: str } };
        if (op === "!~") return { NOT: { title: { contains: str } } };
        if (op === "=") return { title: str };
        if (op === "!=") return { NOT: { title: str } };
      }
    }

    if (field === "description") {
      const str = this.extractSingleString(val);
      if (str) {
        if (op === "~") return { description: { contains: str } };
        if (op === "!~") return { NOT: { description: { contains: str } } };
      }
    }

    if (field === "text") {
      const str = this.extractSingleString(val);
      if (str) {
        const textWhere = {
          OR: [
            { key: { contains: str } },
            { title: { contains: str } },
            { description: { contains: str } },
          ],
        };
        return op === "!~" ? { NOT: textWhere } : textWhere;
      }
    }

    // Default fallback: match key or title
    return {};
  }

  private mapSortField(field: string): string | null {
    const f = field.toLowerCase();
    switch (f) {
      case "key":
      case "issuekey":
        return "key";
      case "summary":
      case "title":
        return "title";
      case "type":
      case "issuetype":
        return "type";
      case "status":
        return "status";
      case "priority":
        return "priority";
      case "storypoints":
      case "points":
        return "storyPoints";
      case "created":
      case "createdat":
        return "createdAt";
      case "updated":
      case "updatedat":
        return "updatedAt";
      case "duedate":
        return "dueDate";
      default:
        return null;
    }
  }

  private extractStrings(val: TQLValue): string[] {
    if (val.type === "STRING") return [val.value];
    if (val.type === "LIST") {
      return val.values.map((v) => (v.type === "STRING" ? v.value : String(v)));
    }
    return [];
  }

  private extractSingleString(val: TQLValue): string | null {
    if (val.type === "STRING") return val.value;
    return null;
  }

  private extractNumber(val: TQLValue): number | null {
    if (val.type === "NUMBER") return val.value;
    if (val.type === "STRING") {
      const n = Number(val.value);
      return isNaN(n) ? null : n;
    }
    return null;
  }

  private parseDateValue(val: TQLValue): Date | null {
    // Functions: now(), startOfDay(), endOfDay()
    if (val.type === "FUNCTION") {
      const fname = val.name.toLowerCase();
      const now = new Date();
      if (fname === "now") return now;
      if (fname === "startofday") {
        now.setHours(0, 0, 0, 0);
        return now;
      }
      if (fname === "endofday") {
        now.setHours(23, 59, 59, 999);
        return now;
      }
    }

    if (val.type === "STRING") {
      const s = val.value.trim();

      // Relative durations: -7d, -24h, -2w, -1m, -1y, +3d
      const match = s.match(/^([+-]?\d+)([dwmyh])$/i);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const date = new Date();

        if (unit === "h") date.setHours(date.getHours() + amount);
        else if (unit === "d") date.setDate(date.getDate() + amount);
        else if (unit === "w") date.setDate(date.getDate() + amount * 7);
        else if (unit === "m") date.setMonth(date.getMonth() + amount);
        else if (unit === "y") date.setFullYear(date.getFullYear() + amount);

        return date;
      }

      // ISO date string
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }
}
