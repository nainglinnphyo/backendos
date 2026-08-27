import type { PoolClient } from "pg";
import { quoteIdent, qualifyIdent, assertValidIdentifier } from "./identifiers.js";
import { buildPgType, buildDefaultClause } from "./pg-type-map.js";
import type {
  AlterColumnInput,
  CreateColumnInput,
  CreateForeignKeyInput,
  CreateIndexInput,
  CreateTableInput,
  CreateUniqueConstraintInput,
  ForeignKeyAction,
} from "./types.js";

function defaultConstraintName(table: string, columns: string[], suffix: string): string {
  return `${table}_${columns.join("_")}_${suffix}`.slice(0, 63);
}

function columnDefSql(col: CreateColumnInput): string {
  const parts = [quoteIdent(col.name, "column"), buildPgType(col.type, { length: col.length, precision: col.precision, scale: col.scale })];
  if (col.nullable === false) parts.push("NOT NULL");
  if (col.default) parts.push(`DEFAULT ${buildDefaultClause(col.default)}`);
  return parts.join(" ");
}

function fkActionSql(action?: ForeignKeyAction): string {
  return action ? action.toUpperCase() : "NO ACTION";
}

export async function createSchema(client: PoolClient, schemaName: string): Promise<void> {
  assertValidIdentifier(schemaName, "schema");
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName, "schema")}`);
}

export async function dropSchema(client: PoolClient, schemaName: string): Promise<void> {
  assertValidIdentifier(schemaName, "schema");
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName, "schema")} CASCADE`);
}

export async function createTable(client: PoolClient, schema: string, input: CreateTableInput): Promise<void> {
  assertValidIdentifier(input.name, "table");
  if (input.columns.length === 0) throw new Error("A table needs at least one column");

  const columnDefs = input.columns.map(columnDefSql);
  const pkColumns = input.columns.filter((c) => c.primaryKey).map((c) => c.name);
  if (pkColumns.length > 0) {
    columnDefs.push(`PRIMARY KEY (${pkColumns.map((c) => quoteIdent(c, "column")).join(", ")})`);
  }

  const sql = `CREATE TABLE ${qualifyIdent(schema, input.name)} (\n  ${columnDefs.join(",\n  ")}\n)`;
  await client.query(sql);

  for (const col of input.columns) {
    if (col.unique && !col.primaryKey) {
      await addUniqueConstraint(client, schema, input.name, { columns: [col.name] });
    }
  }
}

export async function dropTable(client: PoolClient, schema: string, tableName: string): Promise<void> {
  assertValidIdentifier(tableName, "table");
  await client.query(`DROP TABLE ${qualifyIdent(schema, tableName)} CASCADE`);
}

export async function renameTable(client: PoolClient, schema: string, tableName: string, newName: string): Promise<void> {
  assertValidIdentifier(newName, "table");
  await client.query(`ALTER TABLE ${qualifyIdent(schema, tableName)} RENAME TO ${quoteIdent(newName, "table")}`);
}

export async function addColumn(client: PoolClient, schema: string, tableName: string, column: CreateColumnInput): Promise<void> {
  await client.query(`ALTER TABLE ${qualifyIdent(schema, tableName)} ADD COLUMN ${columnDefSql(column)}`);
  if (column.unique && !column.primaryKey) {
    await addUniqueConstraint(client, schema, tableName, { columns: [column.name] });
  }
}

export async function dropColumn(client: PoolClient, schema: string, tableName: string, columnName: string): Promise<void> {
  assertValidIdentifier(columnName, "column");
  await client.query(`ALTER TABLE ${qualifyIdent(schema, tableName)} DROP COLUMN ${quoteIdent(columnName, "column")} CASCADE`);
}

export async function renameColumn(
  client: PoolClient,
  schema: string,
  tableName: string,
  columnName: string,
  newName: string,
): Promise<void> {
  assertValidIdentifier(newName, "column");
  await client.query(
    `ALTER TABLE ${qualifyIdent(schema, tableName)} RENAME COLUMN ${quoteIdent(columnName, "column")} TO ${quoteIdent(newName, "column")}`,
  );
}

/**
 * Applies type/nullable/default changes to an existing column. Rename is handled separately
 * (Postgres requires its own RENAME COLUMN statement).
 */
export async function alterColumn(
  client: PoolClient,
  schema: string,
  tableName: string,
  columnName: string,
  changes: AlterColumnInput,
): Promise<void> {
  const table = qualifyIdent(schema, tableName);
  const col = quoteIdent(columnName, "column");

  if (changes.type) {
    const pgType = buildPgType(changes.type, { length: changes.length, precision: changes.precision, scale: changes.scale });
    await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE ${pgType} USING ${col}::${pgType}`);
  }

  if (changes.nullable !== undefined) {
    await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} ${changes.nullable ? "DROP NOT NULL" : "SET NOT NULL"}`);
  }

  if (changes.default !== undefined) {
    if (changes.default === null) {
      await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP DEFAULT`);
    } else {
      await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} SET DEFAULT ${buildDefaultClause(changes.default)}`);
    }
  }

  if (changes.newName) {
    await renameColumn(client, schema, tableName, columnName, changes.newName);
  }
}

export async function addPrimaryKey(client: PoolClient, schema: string, tableName: string, columns: string[], name?: string): Promise<void> {
  const constraintName = name ?? defaultConstraintName(tableName, columns, "pkey");
  const cols = columns.map((c) => quoteIdent(c, "column")).join(", ");
  await client.query(
    `ALTER TABLE ${qualifyIdent(schema, tableName)} ADD CONSTRAINT ${quoteIdent(constraintName, "constraint")} PRIMARY KEY (${cols})`,
  );
}

export async function addUniqueConstraint(
  client: PoolClient,
  schema: string,
  tableName: string,
  input: CreateUniqueConstraintInput,
): Promise<void> {
  const constraintName = input.name ?? defaultConstraintName(tableName, input.columns, "key");
  const cols = input.columns.map((c) => quoteIdent(c, "column")).join(", ");
  await client.query(
    `ALTER TABLE ${qualifyIdent(schema, tableName)} ADD CONSTRAINT ${quoteIdent(constraintName, "constraint")} UNIQUE (${cols})`,
  );
}

export async function addForeignKey(
  client: PoolClient,
  schema: string,
  tableName: string,
  input: CreateForeignKeyInput,
): Promise<void> {
  const constraintName = input.name ?? defaultConstraintName(tableName, input.columns, "fkey");
  const cols = input.columns.map((c) => quoteIdent(c, "column")).join(", ");
  const refCols = input.referencedColumns.map((c) => quoteIdent(c, "column")).join(", ");
  assertValidIdentifier(input.referencedTable, "table");
  await client.query(
    `ALTER TABLE ${qualifyIdent(schema, tableName)}
     ADD CONSTRAINT ${quoteIdent(constraintName, "constraint")}
     FOREIGN KEY (${cols}) REFERENCES ${qualifyIdent(schema, input.referencedTable)} (${refCols})
     ON DELETE ${fkActionSql(input.onDelete)} ON UPDATE ${fkActionSql(input.onUpdate)}`,
  );
}

export async function dropConstraint(client: PoolClient, schema: string, tableName: string, constraintName: string): Promise<void> {
  assertValidIdentifier(constraintName, "constraint");
  await client.query(
    `ALTER TABLE ${qualifyIdent(schema, tableName)} DROP CONSTRAINT ${quoteIdent(constraintName, "constraint")}`,
  );
}

export async function createIndex(client: PoolClient, schema: string, tableName: string, input: CreateIndexInput): Promise<void> {
  const indexName = input.name ?? defaultConstraintName(tableName, input.columns, "idx");
  assertValidIdentifier(indexName, "index");
  const cols = input.columns.map((c) => quoteIdent(c, "column")).join(", ");
  const unique = input.unique ? "UNIQUE " : "";
  const method = input.method ?? "btree";
  await client.query(
    `CREATE ${unique}INDEX ${quoteIdent(indexName, "index")} ON ${qualifyIdent(schema, tableName)} USING ${method} (${cols})`,
  );
}

export async function dropIndex(client: PoolClient, schema: string, indexName: string): Promise<void> {
  assertValidIdentifier(indexName, "index");
  await client.query(`DROP INDEX ${qualifyIdent(schema, indexName)}`);
}
