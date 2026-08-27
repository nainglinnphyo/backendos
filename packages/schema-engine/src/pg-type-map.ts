import type { ColumnTypeInput, DefaultValueInput } from "./types.js";

/** Function-style defaults we allow developers to pick from the dashboard/API (never free-form SQL). */
export const ALLOWED_DEFAULT_EXPRESSIONS = new Set([
  "now()",
  "gen_random_uuid()",
  "current_date",
  "current_timestamp",
]);

export interface BuildTypeOptions {
  length?: number;
  precision?: number;
  scale?: number;
}

/** Turns a BackendOS column type + modifiers into a Postgres DDL type fragment. Never accepts free-form input. */
export function buildPgType(type: ColumnTypeInput, opts: BuildTypeOptions = {}): string {
  switch (type) {
    case "uuid":
      return "uuid";
    case "text":
      return "text";
    case "varchar": {
      const len = opts.length && opts.length > 0 ? Math.min(opts.length, 10485760) : undefined;
      return len ? `varchar(${len})` : "varchar";
    }
    case "integer":
      return "integer";
    case "bigint":
      return "bigint";
    case "smallint":
      return "smallint";
    case "numeric": {
      if (opts.precision) {
        const scale = opts.scale ?? 0;
        return `numeric(${opts.precision},${scale})`;
      }
      return "numeric";
    }
    case "real":
      return "real";
    case "double precision":
      return "double precision";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "timestamp":
      return "timestamp";
    case "timestamptz":
      return "timestamptz";
    case "json":
      return "json";
    case "jsonb":
      return "jsonb";
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported column type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Renders a DefaultValueInput to a SQL fragment. Literals are rendered as safely-escaped
 * SQL literals (not query params - DEFAULT clauses can't use placeholders); expressions are
 * checked against an allow-list so arbitrary SQL can never be injected via a default value.
 */
export function buildDefaultClause(def: DefaultValueInput): string {
  if (def.kind === "expression") {
    const expr = String(def.value).toLowerCase().trim();
    if (!ALLOWED_DEFAULT_EXPRESSIONS.has(expr)) {
      throw new Error(`Unsupported default expression: "${def.value}"`);
    }
    return expr;
  }
  const v = def.value;
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("Default numeric value must be finite");
    return String(v);
  }
  // string literal - escape single quotes
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Maps introspected Postgres udt_name to the TypeScript type used in generated Row/Insert/Update types. */
export function pgUdtToTsType(udtName: string): { ts: string; isDate: boolean } {
  switch (udtName) {
    case "uuid":
    case "text":
    case "varchar":
    case "bpchar":
    case "char":
      return { ts: "string", isDate: false };
    case "int2":
    case "int4":
    case "float4":
    case "float8":
      return { ts: "number", isDate: false };
    case "int8": // bigint - node-postgres returns this as a string to avoid precision loss
    case "numeric": // arbitrary precision - returned as string to avoid precision loss
      return { ts: "string", isDate: false };
    case "bool":
      return { ts: "boolean", isDate: false };
    case "date":
    case "timestamp":
    case "timestamptz":
      return { ts: "Date", isDate: true };
    case "json":
    case "jsonb":
      return { ts: "Json", isDate: false };
    default:
      return { ts: "unknown", isDate: false };
  }
}
