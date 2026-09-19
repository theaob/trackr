import { TQLToken, KEYWORDS, OPERATORS } from "./tokens";

export class TQLLexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): TQLToken[] {
    const tokens: TQLToken[] = [];
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      // Single-character delimiters
      if (char === "(") {
        tokens.push(this.makeToken("LPAREN", "(", 1));
        continue;
      }
      if (char === ")") {
        tokens.push(this.makeToken("RPAREN", ")", 1));
        continue;
      }
      if (char === ",") {
        tokens.push(this.makeToken("COMMA", ",", 1));
        continue;
      }

      // Operators
      if (char === "=" || char === "~") {
        tokens.push(this.makeToken("OPERATOR", char, 1));
        continue;
      }

      if (char === "!") {
        if (this.peek(1) === "=") {
          tokens.push(this.makeToken("OPERATOR", "!=", 2));
          continue;
        }
        if (this.peek(1) === "~") {
          tokens.push(this.makeToken("OPERATOR", "!~", 2));
          continue;
        }
        // Lone !
        tokens.push(this.makeToken("OPERATOR", "!", 1));
        continue;
      }

      if (char === ">") {
        if (this.peek(1) === "=") {
          tokens.push(this.makeToken("OPERATOR", ">=", 2));
          continue;
        }
        tokens.push(this.makeToken("OPERATOR", ">", 1));
        continue;
      }

      if (char === "<") {
        if (this.peek(1) === "=") {
          tokens.push(this.makeToken("OPERATOR", "<=", 2));
          continue;
        }
        tokens.push(this.makeToken("OPERATOR", "<", 1));
        continue;
      }

      // Quoted Strings: "string" or 'string'
      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      // Numbers or signed relative time (e.g. 10, -7d, +3w)
      if (this.isDigit(char) || ((char === "-" || char === "+") && this.isDigit(this.peek(1)))) {
        tokens.push(this.readNumberOrIdentifier());
        continue;
      }

      // Identifiers / Keywords / Functions / Custom fields (e.g. cf[...])
      if (this.isIdentifierStart(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Fallback for unknown symbol: capture as 1-char identifier to allow parser to report syntax error
      tokens.push(this.makeToken("IDENTIFIER", char, 1));
    }

    tokens.push({
      type: "EOF",
      value: "",
      start: this.pos,
      end: this.pos,
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private skipWhitespace() {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === " " || char === "\t" || char === "\r") {
        this.pos++;
        this.column++;
      } else if (char === "\n") {
        this.pos++;
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private readString(quote: string): TQLToken {
    const start = this.pos;
    const startCol = this.column;
    const startLine = this.line;

    this.pos++; // skip opening quote
    this.column++;

    let value = "";
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === "\\") {
        // Escaped character
        this.pos++;
        this.column++;
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
          this.pos++;
          this.column++;
        }
      } else if (char === quote) {
        // Closing quote
        this.pos++;
        this.column++;
        break;
      } else if (char === "\n") {
        this.line++;
        this.column = 1;
        value += char;
        this.pos++;
      } else {
        value += char;
        this.pos++;
        this.column++;
      }
    }

    return {
      type: "STRING",
      value,
      start,
      end: this.pos,
      line: startLine,
      column: startCol,
    };
  }

  private readNumberOrIdentifier(): TQLToken {
    const start = this.pos;
    const startCol = this.column;
    const startLine = this.line;

    let hasLetters = false;
    let isSigned = false;

    if (this.input[this.pos] === "-" || this.input[this.pos] === "+") {
      isSigned = true;
      this.pos++;
      this.column++;
    }

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (this.isDigit(char) || char === ".") {
        this.pos++;
        this.column++;
      } else if (this.isIdentifierPart(char)) {
        hasLetters = true;
        this.pos++;
        this.column++;
      } else {
        break;
      }
    }

    const value = this.input.slice(start, this.pos);
    // If it has letters or signs with units (e.g. -7d), treat as IDENTIFIER for date parsing
    const type = hasLetters || isSigned ? "IDENTIFIER" : "NUMBER";

    return {
      type,
      value,
      start,
      end: this.pos,
      line: startLine,
      column: startCol,
    };
  }

  private readIdentifier(): TQLToken {
    const start = this.pos;
    const startCol = this.column;
    const startLine = this.line;

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === "[") {
        // Support cf[Environment Name] or customfield[1000]
        while (this.pos < this.input.length && this.input[this.pos] !== "]") {
          this.pos++;
          this.column++;
        }
        if (this.pos < this.input.length && this.input[this.pos] === "]") {
          this.pos++;
          this.column++;
        }
      } else if (this.isIdentifierPart(char)) {
        this.pos++;
        this.column++;
      } else {
        break;
      }
    }

    const raw = this.input.slice(start, this.pos);
    const upper = raw.toUpperCase();

    const isKeyword = KEYWORDS.has(upper);

    return {
      type: isKeyword ? "KEYWORD" : "IDENTIFIER",
      value: isKeyword ? upper : raw,
      start,
      end: this.pos,
      line: startLine,
      column: startCol,
    };
  }

  private isDigit(char: string | undefined): boolean {
    return !!char && char >= "0" && char <= "9";
  }

  private isIdentifierStart(char: string | undefined): boolean {
    if (!char) return false;
    return (
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      char === "_" ||
      char === "@"
    );
  }

  private isIdentifierPart(char: string | undefined): boolean {
    if (!char) return false;
    return (
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      (char >= "0" && char <= "9") ||
      char === "_" ||
      char === "-" ||
      char === "." ||
      char === "@" ||
      char === ":"
    );
  }

  private peek(offset: number = 1): string | undefined {
    return this.input[this.pos + offset];
  }

  private makeToken(type: TQLToken["type"], value: string, length: number): TQLToken {
    const token: TQLToken = {
      type,
      value,
      start: this.pos,
      end: this.pos + length,
      line: this.line,
      column: this.column,
    };
    this.pos += length;
    this.column += length;
    return token;
  }
}
