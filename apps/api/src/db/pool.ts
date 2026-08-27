import { Pool, type PoolClient } from "pg";
import { config } from "../config.js";

/** Shared Postgres pool. Every project's schema lives inside this same instance for v1. */
export const controlPool = new Pool({ connectionString: config.databaseUrl });

export const META_SCHEMA = "backendos_meta";

export interface TenantContext {
  pool: Pool;
  schemaName: string;
}

/**
 * Resolves the Postgres connection to use for a given project's data.
 *
 * v1 isolation strategy: schema-per-project inside one shared instance, so this just pairs
 * the shared pool with the project's schema name. Nothing outside this function assumes a
 * shared pool - callers always go through a TenantContext - so upgrading to database-per-project
 * later (e.g. for larger customers) only means changing this function to look up or lazily
 * create/connect a dedicated Pool per project, without touching DDL, introspection, or the
 * query builder.
 */
export function getTenantContext(schemaName: string): TenantContext {
  return { pool: controlPool, schemaName };
}

/** Runs `fn` with a checked-out client inside a transaction, committing/rolling back automatically. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await controlPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
