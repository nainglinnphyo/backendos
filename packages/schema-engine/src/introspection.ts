import type { Pool, PoolClient } from "pg";
import type {
  ColumnSchema,
  DatabaseSchema,
  ForeignKeySchema,
  IndexSchema,
  TableSchema,
  UniqueConstraintSchema,
} from "./types.js";
import { toCamelCase } from "./naming.js";

type Queryable = Pool | PoolClient;

const FK_ACTION_MAP: Record<string, string> = {
  a: "no action",
  r: "restrict",
  c: "cascade",
  n: "set null",
  d: "set default",
};

interface RawColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: boolean;
  ordinal_position: number;
}

interface RawKeyConstraintRow {
  name: string;
  type: "p" | "u";
  table_name: string;
  columns: string[];
}

interface RawForeignKeyRow {
  name: string;
  table_name: string;
  referenced_table: string;
  columns: string[];
  referenced_columns: string[];
  confupdtype: string;
  confdeltype: string;
}

interface RawIndexRow {
  index_name: string;
  table_name: string;
  is_unique: boolean;
  is_primary: boolean;
  method: string;
  columns: string[];
}

/**
 * Introspects a single Postgres schema (one BackendOS project) and returns a
 * normalized description of its tables, columns, keys, and indexes. This is
 * the single source of truth used to generate the auto API and TypeScript types.
 */
export async function introspectSchema(db: Queryable, schemaName: string): Promise<DatabaseSchema> {
  const [tableNames, columns, keyConstraints, foreignKeys, indexes] = await Promise.all([
    fetchTableNames(db, schemaName),
    fetchColumns(db, schemaName),
    fetchKeyConstraints(db, schemaName),
    fetchForeignKeys(db, schemaName),
    fetchIndexes(db, schemaName),
  ]);

  const tables: TableSchema[] = tableNames.map((tableName) => {
    const tableColumns = columns.filter((c) => c.table_name === tableName);
    const pkConstraint = keyConstraints.find((k) => k.table_name === tableName && k.type === "p");
    const uniqueConstraints: UniqueConstraintSchema[] = keyConstraints
      .filter((k) => k.table_name === tableName && k.type === "u")
      .map((k) => ({ name: k.name, columns: k.columns }));
    const primaryKey = pkConstraint?.columns ?? [];
    const uniqueColumnSet = new Set(uniqueConstraints.flatMap((u) => (u.columns.length === 1 ? u.columns : [])));

    const tableForeignKeys: ForeignKeySchema[] = foreignKeys
      .filter((fk) => fk.table_name === tableName)
      .map((fk) => ({
        name: fk.name,
        columns: fk.columns,
        referencedTable: fk.referenced_table,
        referencedColumns: fk.referenced_columns,
        onDelete: FK_ACTION_MAP[fk.confdeltype] ?? null,
        onUpdate: FK_ACTION_MAP[fk.confupdtype] ?? null,
      }));

    const tableIndexes: IndexSchema[] = indexes
      .filter((ix) => ix.table_name === tableName)
      .map((ix) => ({
        name: ix.index_name,
        columns: ix.columns,
        isUnique: ix.is_unique,
        isPrimary: ix.is_primary,
        method: ix.method,
      }));

    const resolvedColumns: ColumnSchema[] = tableColumns.map((c) => ({
      name: c.column_name,
      apiName: toCamelCase(c.column_name),
      udtName: c.udt_name,
      dataType: c.data_type,
      isNullable: c.is_nullable,
      columnDefault: c.column_default,
      characterMaximumLength: c.character_maximum_length,
      numericPrecision: c.numeric_precision,
      numericScale: c.numeric_scale,
      isPrimaryKey: primaryKey.includes(c.column_name),
      isUnique: uniqueColumnSet.has(c.column_name) || primaryKey.includes(c.column_name),
      isIdentity: c.is_identity,
      ordinalPosition: c.ordinal_position,
    }));

    return {
      name: tableName,
      columns: resolvedColumns,
      primaryKey,
      foreignKeys: tableForeignKeys,
      uniqueConstraints,
      indexes: tableIndexes,
    };
  });

  return { schemaName, tables, generatedAt: new Date().toISOString() };
}

async function fetchTableNames(db: Queryable, schemaName: string): Promise<string[]> {
  const res = await db.query<{ tablename: string }>(
    `select tablename from pg_catalog.pg_tables where schemaname = $1 order by tablename`,
    [schemaName],
  );
  return res.rows.map((r) => r.tablename);
}

async function fetchColumns(db: Queryable, schemaName: string): Promise<RawColumnRow[]> {
  const res = await db.query<RawColumnRow>(
    `select
       c.table_name,
       c.column_name,
       c.udt_name,
       c.data_type,
       (c.is_nullable = 'YES') as is_nullable,
       c.column_default,
       c.character_maximum_length,
       c.numeric_precision,
       c.numeric_scale,
       (c.is_identity = 'YES') as is_identity,
       c.ordinal_position
     from information_schema.columns c
     where c.table_schema = $1
     order by c.table_name, c.ordinal_position`,
    [schemaName],
  );
  return res.rows;
}

/** Primary key + unique constraints, using pg_constraint so composite-column order is preserved exactly. */
async function fetchKeyConstraints(db: Queryable, schemaName: string): Promise<RawKeyConstraintRow[]> {
  const res = await db.query<RawKeyConstraintRow>(
    `select
       con.conname as name,
       con.contype as type,
       cl.relname as table_name,
       array(
         select att.attname::text
         from unnest(con.conkey) with ordinality as u(attnum, ord)
         join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum
         order by u.ord
       ) as columns
     from pg_constraint con
     join pg_class cl on cl.oid = con.conrelid
     join pg_namespace ns on ns.oid = cl.relnamespace
     where con.contype in ('p', 'u') and ns.nspname = $1
     order by cl.relname, con.conname`,
    [schemaName],
  );
  return res.rows;
}

async function fetchForeignKeys(db: Queryable, schemaName: string): Promise<RawForeignKeyRow[]> {
  const res = await db.query<RawForeignKeyRow>(
    `select
       con.conname as name,
       cl.relname as table_name,
       frel.relname as referenced_table,
       con.confupdtype,
       con.confdeltype,
       array(
         select att.attname::text
         from unnest(con.conkey) with ordinality as u(attnum, ord)
         join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum
         order by u.ord
       ) as columns,
       array(
         select att.attname::text
         from unnest(con.confkey) with ordinality as u(attnum, ord)
         join pg_attribute att on att.attrelid = con.confrelid and att.attnum = u.attnum
         order by u.ord
       ) as referenced_columns
     from pg_constraint con
     join pg_class cl on cl.oid = con.conrelid
     join pg_class frel on frel.oid = con.confrelid
     join pg_namespace ns on ns.oid = cl.relnamespace
     where con.contype = 'f' and ns.nspname = $1
     order by cl.relname, con.conname`,
    [schemaName],
  );
  return res.rows;
}

async function fetchIndexes(db: Queryable, schemaName: string): Promise<RawIndexRow[]> {
  const res = await db.query<RawIndexRow>(
    `select
       ic.relname as index_name,
       tc.relname as table_name,
       ix.indisunique as is_unique,
       ix.indisprimary as is_primary,
       am.amname as method,
       array(
         select att.attname::text
         from unnest(ix.indkey) with ordinality as u(attnum, ord)
         join pg_attribute att on att.attrelid = ix.indrelid and att.attnum = u.attnum
         order by u.ord
       ) as columns
     from pg_index ix
     join pg_class ic on ic.oid = ix.indexrelid
     join pg_class tc on tc.oid = ix.indrelid
     join pg_namespace ns on ns.oid = tc.relnamespace
     join pg_am am on am.oid = ic.relam
     where ns.nspname = $1
     order by tc.relname, ic.relname`,
    [schemaName],
  );
  return res.rows;
}
