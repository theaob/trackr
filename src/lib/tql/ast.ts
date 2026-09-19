export type TQLOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "~"
  | "!~"
  | "IN"
  | "NOT IN"
  | "IS EMPTY"
  | "IS NOT EMPTY";

export type TQLValue =
  | { type: "STRING"; value: string }
  | { type: "NUMBER"; value: number }
  | { type: "FUNCTION"; name: string; args: TQLValue[] }
  | { type: "LIST"; values: TQLValue[] }
  | { type: "EMPTY" };

export interface TQLBinaryNode {
  type: "AND" | "OR";
  left: TQLNode;
  right: TQLNode;
}

export interface TQLNotNode {
  type: "NOT";
  child: TQLNode;
}

export interface TQLPredicateNode {
  type: "PREDICATE";
  field: string;
  operator: TQLOperator;
  value: TQLValue;
}

export type TQLNode = TQLBinaryNode | TQLNotNode | TQLPredicateNode;

export interface TQLOrderBy {
  field: string;
  direction: "ASC" | "DESC";
}

export interface TQLQuery {
  where?: TQLNode;
  orderBy: TQLOrderBy[];
}

export interface TQLParseError {
  message: string;
  position: number;
  line: number;
  column: number;
  expected?: string[];
}

export type TQLParseResult =
  | { success: true; query: TQLQuery }
  | { success: false; error: TQLParseError };
