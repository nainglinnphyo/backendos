import { qualifyIdent, quoteIdent } from "./identifiers.js";
import type { TableSchema } from "./types.js";
import {
  QueryValidationError,
  type CreateQuery,
  type DeleteQuery,
  type FieldFilterObject,
  type FilterValue,
  type FindManyQuery,
  type OrderByInput,
  type UpdateQuery,
  type WhereInput,
} from "./query-types.js";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

class ParamList {
  values: unknown[] = [];
  push(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

/** Looks up a column by its API (camelCase) name - the name used on the wire and in generated types. */
function requireColumn(table: TableSchema, apiName: string) {
  const col = table.columns.find((c) => c.apiName === apiName);
  if (!col) {
    throw new QueryValidationError(`Unknown column "${apiName}" on table "${table.name}"`);
  }
  return col;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildFieldCondition(table: TableSchema, column: string, filter: FilterValue | FieldFilterObject, params: ParamList): string {
  const col = requireColumn(table, column);
  const ident = quoteIdent(col.name, "column");

  if (filter === null || typeof filter !== "object") {
    return filter === null ? `${ident} IS NULL` : `${ident} = ${params.push(filter)}`;
  }

  const clauses: string[] = [];
  const f = filter as FieldFilterObject;

  if ("equals" in f) clauses.push(f.equals === null ? `${ident} IS NULL` : `${ident} = ${params.push(f.equals)}`);
  if ("not" in f) clauses.push(f.not === null ? `${ident} IS NOT NULL` : `${ident} <> ${params.push(f.not)}`);
  if (f.lt !== undefined) clauses.push(`${ident} < ${params.push(f.lt)}`);
  if (f.lte !== undefined) clauses.push(`${ident} <= ${params.push(f.lte)}`);
  if (f.gt !== undefined) clauses.push(`${ident} > ${params.push(f.gt)}`);
  if (f.gte !== undefined) clauses.push(`${ident} >= ${params.push(f.gte)}`);
  if (f.in !== undefined) {
    if (!Array.isArray(f.in)) throw new QueryValidationError(`"in" filter on "${column}" must be an array`);
    clauses.push(f.in.length === 0 ? "FALSE" : `${ident} = ANY(${params.push(f.in)})`);
  }
  if (f.notIn !== undefined) {
    if (!Array.isArray(f.notIn)) throw new QueryValidationError(`"notIn" filter on "${column}" must be an array`);
    clauses.push(f.notIn.length === 0 ? "TRUE" : `${ident} <> ALL(${params.push(f.notIn)})`);
  }
  if (f.contains !== undefined) clauses.push(`${ident} LIKE ${params.push(`%${escapeLike(f.contains)}%`)} ESCAPE '\\'`);
  if (f.startsWith !== undefined) clauses.push(`${ident} LIKE ${params.push(`${escapeLike(f.startsWith)}%`)} ESCAPE '\\'`);
  if (f.endsWith !== undefined) clauses.push(`${ident} LIKE ${params.push(`%${escapeLike(f.endsWith)}`)} ESCAPE '\\'`);

  if (clauses.length === 0) {
    throw new QueryValidationError(`Empty or unsupported filter on column "${column}"`);
  }
  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(" AND ")})`;
}

export function buildWhereClause(table: TableSchema, where: WhereInput | undefined, params: ParamList): string {
  if (!where || Object.keys(where).length === 0) return "TRUE";

  const parts: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === "AND" || key === "OR") {
      const arr = value as WhereInput[];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const joined = arr.map((w) => `(${buildWhereClause(table, w, params)})`).join(key === "AND" ? " AND " : " OR ");
      parts.push(`(${joined})`);
    } else if (key === "NOT") {
      parts.push(`NOT (${buildWhereClause(table, value as WhereInput, params)})`);
    } else {
      parts.push(buildFieldCondition(table, key, value as FilterValue | FieldFilterObject, params));
    }
  }
  return parts.length === 0 ? "TRUE" : parts.join(" AND ");
}

function buildOrderByEntry(table: TableSchema, entry: OrderByInput): string {
  const keys = Object.keys(entry);
  return keys
    .map((k) => {
      const col = requireColumn(table, k);
      const dir = entry[k] === "desc" ? "DESC" : "ASC";
      return `${quoteIdent(col.name, "column")} ${dir}`;
    })
    .join(", ");
}

function buildOrderByClause(table: TableSchema, orderBy: OrderByInput | OrderByInput[] | undefined): string {
  if (!orderBy) return "";
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const fragments = list.map((o) => buildOrderByEntry(table, o)).filter(Boolean);
  return fragments.length ? ` ORDER BY ${fragments.join(", ")}` : "";
}

/** Builds a SELECT/RETURNING column list, aliasing each DB column to its camelCase API name. */
function buildSelectList(table: TableSchema, select: string[] | undefined): string {
  const columns = select && select.length > 0 ? select.map((c) => requireColumn(table, c)) : table.columns;
  return columns.map((c) => `${quoteIdent(c.name, "column")} AS ${quoteIdent(c.apiName, "column")}`).join(", ");
}

/** Returns true if `whereKeys` fully specifies the table's primary key or any unique constraint. */
export function isUniqueWhere(table: TableSchema, where: WhereInput): boolean {
  const keys = new Set(Object.keys(where).filter((k) => where[k] !== undefined && k !== "AND" && k !== "OR" && k !== "NOT"));
  const keySets = [table.primaryKey, ...table.uniqueConstraints.map((u) => u.columns)];
  return keySets.some((set) => set.length > 0 && set.every((c) => keys.has(c)));
}

export function buildFindMany(schema: string, table: TableSchema, query: FindManyQuery): SqlQuery {
  const params = new ParamList();
  const where = buildWhereClause(table, query.where, params);
  const orderBy = buildOrderByClause(table, query.orderBy);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 0), MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);
  const selectList = buildSelectList(table, query.select);

  const text = `SELECT ${selectList} FROM ${qualifyIdent(schema, table.name)} WHERE ${where}${orderBy} LIMIT ${params.push(limit)} OFFSET ${params.push(offset)}`;
  return { text, values: params.values };
}

export function buildFindUnique(schema: string, table: TableSchema, where: WhereInput, select?: string[]): SqlQuery {
  if (!isUniqueWhere(table, where)) {
    throw new QueryValidationError(
      `findUnique on "${table.name}" requires a "where" that fully specifies the primary key or a unique constraint`,
    );
  }
  const params = new ParamList();
  const whereSql = buildWhereClause(table, where, params);
  const selectList = buildSelectList(table, select);
  const text = `SELECT ${selectList} FROM ${qualifyIdent(schema, table.name)} WHERE ${whereSql} LIMIT 2`;
  return { text, values: params.values };
}

export function buildCount(schema: string, table: TableSchema, where: WhereInput | undefined): SqlQuery {
  const params = new ParamList();
  const whereSql = buildWhereClause(table, where, params);
  const text = `SELECT COUNT(*)::text AS count FROM ${qualifyIdent(schema, table.name)} WHERE ${whereSql}`;
  return { text, values: params.values };
}

function buildInsertOne(schema: string, table: TableSchema, data: Record<string, unknown>, params: ParamList): string {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return `INSERT INTO ${qualifyIdent(schema, table.name)} DEFAULT VALUES RETURNING ${buildSelectList(table, undefined)}`;
  }
  const columns = entries.map(([k]) => quoteIdent(requireColumn(table, k).name, "column"));
  const placeholders = entries.map(([, v]) => params.push(v));
  return `INSERT INTO ${qualifyIdent(schema, table.name)} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
}

export function buildCreate(schema: string, table: TableSchema, query: CreateQuery): SqlQuery {
  const params = new ParamList();
  const rows = Array.isArray(query.data) ? query.data : [query.data];
  if (rows.length === 0) throw new QueryValidationError("create requires at least one row of data");

  if (rows.length === 1) {
    const text = `${buildInsertOne(schema, table, rows[0]!, params)} RETURNING ${buildSelectList(table, undefined)}`;
    return { text, values: params.values };
  }

  // Bulk insert: all rows must share the same column set for a single VALUES-list statement.
  const columnSet = Object.keys(rows[0]!).filter((k) => rows[0]![k] !== undefined);
  const columns = columnSet.map((k) => quoteIdent(requireColumn(table, k).name, "column"));
  const valueRows = rows.map((row) => {
    const placeholders = columnSet.map((k) => {
      if (!(k in row)) throw new QueryValidationError("All rows in a bulk create must have the same fields");
      return params.push(row[k]);
    });
    return `(${placeholders.join(", ")})`;
  });
  const text = `INSERT INTO ${qualifyIdent(schema, table.name)} (${columns.join(", ")}) VALUES ${valueRows.join(", ")} RETURNING ${buildSelectList(table, undefined)}`;
  return { text, values: params.values };
}

function requireNonEmptyWhere(operation: string, where: WhereInput | undefined): asserts where is WhereInput {
  if (!where || Object.keys(where).filter((k) => where[k] !== undefined).length === 0) {
    throw new QueryValidationError(`${operation} requires a non-empty "where" (use findMany + a loop if you really mean "all rows")`);
  }
}

export function buildUpdate(schema: string, table: TableSchema, query: UpdateQuery): SqlQuery {
  requireNonEmptyWhere("update", query.where);
  const params = new ParamList();
  const entries = Object.entries(query.data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) throw new QueryValidationError("update requires at least one field in data");

  const setClause = entries.map(([k, v]) => `${quoteIdent(requireColumn(table, k).name, "column")} = ${params.push(v)}`).join(", ");
  const whereSql = buildWhereClause(table, query.where, params);
  const text = `UPDATE ${qualifyIdent(schema, table.name)} SET ${setClause} WHERE ${whereSql} RETURNING ${buildSelectList(table, undefined)}`;
  return { text, values: params.values };
}

export function buildDelete(schema: string, table: TableSchema, query: DeleteQuery): SqlQuery {
  requireNonEmptyWhere("delete", query.where);
  const params = new ParamList();
  const whereSql = buildWhereClause(table, query.where, params);
  const text = `DELETE FROM ${qualifyIdent(schema, table.name)} WHERE ${whereSql} RETURNING ${buildSelectList(table, undefined)}`;
  return { text, values: params.values };
}

export { QueryValidationError };
