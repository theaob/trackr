import { TQLLexer } from "./lexer";
import { TQLToken } from "./tokens";
import {
  TQLNode,
  TQLQuery,
  TQLOrderBy,
  TQLPredicateNode,
  TQLOperator,
  TQLValue,
  TQLParseResult,
  TQLParseError,
} from "./ast";

export class TQLParser {
  private tokens: TQLToken[];
  private current: number = 0;

  constructor(tokens: TQLToken[]) {
    this.tokens = tokens;
  }

  public static parse(input: string): TQLParseResult {
    if (!input || !input.trim()) {
      return {
        success: true,
        query: { orderBy: [] },
      };
    }

    try {
      const lexer = new TQLLexer(input);
      const tokens = lexer.tokenize();
      const parser = new TQLParser(tokens);
      return parser.parseQuery();
    } catch (err: any) {
      if (err.position !== undefined) {
        return {
          success: false,
          error: err as TQLParseError,
        };
      }
      return {
        success: false,
        error: {
          message: err?.message || "Syntax error parsing query",
          position: 0,
          line: 1,
          column: 1,
        },
      };
    }
  }

  private parseQuery(): TQLParseResult {
    let where: TQLNode | undefined;

    // Check if query starts immediately with ORDER BY
    if (!this.checkKeyword("ORDER")) {
      where = this.parseOr();
    }

    const orderBy: TQLOrderBy[] = [];
    if (this.matchKeyword("ORDER")) {
      this.consumeKeyword("BY", "Expected 'BY' after 'ORDER'");
      do {
        const fieldToken = this.consumeIdentifierOrString("Expected field name in ORDER BY");
        let direction: "ASC" | "DESC" = "ASC";
        if (this.matchKeyword("ASC")) {
          direction = "ASC";
        } else if (this.matchKeyword("DESC")) {
          direction = "DESC";
        }
        orderBy.push({
          field: fieldToken.value,
          direction,
        });
      } while (this.match("COMMA"));
    }

    if (!this.isAtEnd()) {
      throw this.error(this.peek(), `Unexpected token '${this.peek().value}' after query`);
    }

    return {
      success: true,
      query: {
        where,
        orderBy,
      },
    };
  }

  // Precedence level 1: OR
  private parseOr(): TQLNode {
    let expr = this.parseAnd();

    while (this.matchKeyword("OR")) {
      const right = this.parseAnd();
      expr = {
        type: "OR",
        left: expr,
        right,
      };
    }

    return expr;
  }

  // Precedence level 2: AND
  private parseAnd(): TQLNode {
    let expr = this.parseNot();

    while (this.matchKeyword("AND")) {
      const right = this.parseNot();
      expr = {
        type: "AND",
        left: expr,
        right,
      };
    }

    return expr;
  }

  // Precedence level 3: NOT
  private parseNot(): TQLNode {
    if (this.matchKeyword("NOT")) {
      // Check if this is "NOT IN" predicate: e.g. "field NOT IN (...)"
      // This is handled in parsePredicate, so standalone "NOT" is logical negation
      const child = this.parsePrimary();
      return {
        type: "NOT",
        child,
      };
    }

    return this.parsePrimary();
  }

  // Precedence level 4: Grouping (...) or Predicate
  private parsePrimary(): TQLNode {
    if (this.match("LPAREN")) {
      const expr = this.parseOr();
      this.consume("RPAREN", "Expected ')' to close grouped expression");
      return expr;
    }

    return this.parsePredicate();
  }

  // Leaf predicate: field [operator] [value]
  private parsePredicate(): TQLPredicateNode {
    const fieldToken = this.consumeIdentifierOrString("Expected field name");
    const field = fieldToken.value;

    // Check for "IS EMPTY" / "IS NOT EMPTY" / "IS NULL" / "IS NOT NULL"
    if (this.matchKeyword("IS")) {
      if (this.matchKeyword("NOT")) {
        if (this.matchKeyword("EMPTY") || this.matchKeyword("NULL")) {
          return {
            type: "PREDICATE",
            field,
            operator: "IS NOT EMPTY",
            value: { type: "EMPTY" },
          };
        }
        throw this.error(this.peek(), "Expected 'EMPTY' or 'NULL' after 'IS NOT'");
      }

      if (this.matchKeyword("EMPTY") || this.matchKeyword("NULL")) {
        return {
          type: "PREDICATE",
          field,
          operator: "IS EMPTY",
          value: { type: "EMPTY" },
        };
      }

      throw this.error(this.peek(), "Expected 'EMPTY', 'NULL', or 'NOT' after 'IS'");
    }

    // Check for "NOT IN"
    if (this.checkKeyword("NOT") && this.peekNext()?.value?.toUpperCase() === "IN") {
      this.advance(); // consume NOT
      this.advance(); // consume IN
      const val = this.check("LPAREN") ? this.parseValueList() : this.parseValue();
      return {
        type: "PREDICATE",
        field,
        operator: "NOT IN",
        value: val,
      };
    }

    // Check for "IN"
    if (this.matchKeyword("IN")) {
      const val = this.check("LPAREN") ? this.parseValueList() : this.parseValue();
      return {
        type: "PREDICATE",
        field,
        operator: "IN",
        value: val,
      };
    }

    // Standard operator: =, !=, ~, !~, >, >=, <, <=
    if (this.check("OPERATOR")) {
      const opToken = this.advance();
      const operator = opToken.value as TQLOperator;
      const value = this.parseValue();
      return {
        type: "PREDICATE",
        field,
        operator,
        value,
      };
    }

    throw this.error(
      this.peek(),
      `Expected operator (=, !=, ~, !~, >, >=, <, <=, IN, IS) after field '${field}'`
    );
  }

  private parseValue(): TQLValue {
    const token = this.peek();

    // Check for empty/null keywords
    if (token.type === "KEYWORD" && (token.value === "EMPTY" || token.value === "NULL")) {
      this.advance();
      return { type: "EMPTY" };
    }

    // String literal
    if (token.type === "STRING") {
      this.advance();
      return { type: "STRING", value: token.value };
    }

    // Number literal
    if (token.type === "NUMBER") {
      this.advance();
      const num = Number(token.value);
      return { type: "NUMBER", value: isNaN(num) ? 0 : num };
    }

    // Identifier / Function / Value without quotes
    if (token.type === "IDENTIFIER") {
      this.advance();
      // Check if it's a function call: functionName(...)
      if (this.match("LPAREN")) {
        const args: TQLValue[] = [];
        if (!this.check("RPAREN")) {
          do {
            args.push(this.parseValue());
          } while (this.match("COMMA"));
        }
        this.consume("RPAREN", `Expected ')' to close arguments for function '${token.value}'`);
        return {
          type: "FUNCTION",
          name: token.value,
          args,
        };
      }

      return { type: "STRING", value: token.value };
    }

    throw this.error(token, `Expected a value, string, number, or function call, got '${token.value}'`);
  }

  private parseValueList(): TQLValue {
    this.consume("LPAREN", "Expected '(' starting value list for IN operator");
    const values: TQLValue[] = [];
    if (!this.check("RPAREN")) {
      do {
        values.push(this.parseValue());
      } while (this.match("COMMA"));
    }
    this.consume("RPAREN", "Expected ')' ending value list for IN operator");
    return {
      type: "LIST",
      values,
    };
  }

  // Helpers
  private match(...types: TQLToken["type"][]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchKeyword(keyword: string): boolean {
    if (this.checkKeyword(keyword)) {
      this.advance();
      return true;
    }
    return false;
  }

  private checkKeyword(keyword: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return token.type === "KEYWORD" && token.value.toUpperCase() === keyword.toUpperCase();
  }

  private consumeKeyword(keyword: string, message: string): TQLToken {
    if (this.checkKeyword(keyword)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private consume(type: TQLToken["type"], message: string): TQLToken {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private consumeIdentifierOrString(message: string): TQLToken {
    if (this.check("IDENTIFIER") || this.check("STRING")) {
      return this.advance();
    }
    throw this.error(this.peek(), message);
  }

  private check(type: TQLToken["type"]): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): TQLToken {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): TQLToken {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
  }

  private peekNext(): TQLToken | undefined {
    return this.tokens[this.current + 1];
  }

  private previous(): TQLToken {
    return this.tokens[this.current - 1];
  }

  private error(token: TQLToken, message: string): TQLParseError {
    return {
      message,
      position: token.start,
      line: token.line,
      column: token.column,
    };
  }
}
