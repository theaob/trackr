export type TokenType =
  | "IDENTIFIER"
  | "STRING"
  | "NUMBER"
  | "OPERATOR"
  | "KEYWORD"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface TQLToken {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export const KEYWORDS = new Set([
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "EMPTY",
  "NULL",
  "ORDER",
  "BY",
  "ASC",
  "DESC",
]);

export const OPERATORS = new Set([
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "~",
  "!~",
]);
