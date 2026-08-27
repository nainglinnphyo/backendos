/** The column types a developer can pick from BackendOS table editor / API. */
export type ColumnTypeInput =
  | "uuid"
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "smallint"
  | "numeric"
  | "real"
  | "double precision"
  | "boolean"
  | "date"
  | "timestamp"
  | "timestamptz"
  | "json"
  | "jsonb";

export type ForeignKeyAction = "cascade" | "set null" | "restrict" | "no action" | "set default";

export interface DefaultValueInput {
  /** Raw literal value (string/number/boolean/null) or a whitelisted SQL function keyword. */
  kind: "literal" | "expression";
  value: string | number | boolean | null;
}

export interface CreateColumnInput {
  name: string;
  type: ColumnTypeInput;
  /** varchar length */
  length?: number;
  /** numeric precision */
  precision?: number;
  /** numeric scale */
  scale?: number;
  nullable?: boolean;
  default?: DefaultValueInput | null;
  primaryKey?: boolean;
  unique?: boolean;
}

export interface CreateTableInput {
  name: string;
  columns: CreateColumnInput[];
}

export interface AlterColumnInput {
  newName?: string;
  type?: ColumnTypeInput;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  /** undefined = leave default unchanged. null = drop default. object = set default. */
  default?: DefaultValueInput | null;
}

export interface CreateForeignKeyInput {
  name?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface CreateIndexInput {
  name?: string;
  columns: string[];
  unique?: boolean;
  method?: "btree" | "gin" | "gist" | "hash";
}

export interface CreateUniqueConstraintInput {
  name?: string;
  columns: string[];
}

/** ---- Introspected schema (read model) ---- */

export interface ColumnSchema {
  name: string;
  /** camelCase name used in generated types and on the wire, e.g. "created_at" -> "createdAt" */
  apiName: string;
  /** Normalized Postgres type name, e.g. "uuid", "int4", "varchar", "timestamptz" */
  udtName: string;
  /** Human readable data_type from information_schema, e.g. "character varying" */
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isIdentity: boolean;
  ordinalPosition: number;
}

export interface ForeignKeySchema {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string | null;
  onUpdate: string | null;
}

export interface UniqueConstraintSchema {
  name: string;
  columns: string[];
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  method: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys: ForeignKeySchema[];
  uniqueConstraints: UniqueConstraintSchema[];
  indexes: IndexSchema[];
}

export interface DatabaseSchema {
  schemaName: string;
  tables: TableSchema[];
  generatedAt: string;
}

export function findTable(db: DatabaseSchema, tableName: string): TableSchema | undefined {
  return db.tables.find((t) => t.name === tableName);
}

export function findColumn(table: TableSchema, columnName: string): ColumnSchema | undefined {
  return table.columns.find((c) => c.name === columnName);
}
