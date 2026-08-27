/**
 * All dynamic SQL identifiers (table/column/index/constraint names) must pass
 * through here before being interpolated into SQL. Values NEVER get interpolated
 * directly - they always travel as parameterized query args ($1, $2, ...).
 */

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
const RESERVED = new Set(["pg_catalog", "information_schema"]);

export class InvalidIdentifierError extends Error {
  constructor(kind: string, value: string) {
    super(`Invalid ${kind}: "${value}". Identifiers must match ${IDENTIFIER_RE} and be <= 63 chars.`);
    this.name = "InvalidIdentifierError";
  }
}

export function assertValidIdentifier(name: string, kind = "identifier"): string {
  if (typeof name !== "string" || !IDENTIFIER_RE.test(name) || RESERVED.has(name.toLowerCase())) {
    throw new InvalidIdentifierError(kind, String(name));
  }
  return name;
}

/** Quotes + validates a single SQL identifier (table, column, index, constraint name). */
export function quoteIdent(name: string, kind = "identifier"): string {
  assertValidIdentifier(name, kind);
  return `"${name.replace(/"/g, '""')}"`;
}

/** Quotes a schema-qualified identifier: schema.table */
export function qualifyIdent(schema: string, name: string): string {
  return `${quoteIdent(schema, "schema")}.${quoteIdent(name, "table")}`;
}

export function isValidIdentifier(name: string): boolean {
  return typeof name === "string" && IDENTIFIER_RE.test(name) && !RESERVED.has(name.toLowerCase());
}
