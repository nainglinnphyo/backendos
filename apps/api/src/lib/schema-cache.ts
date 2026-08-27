import { introspectSchema, type DatabaseSchema } from "@backendos/schema-engine";
import { controlPool } from "../db/pool.js";

const cache = new Map<string, DatabaseSchema>();

/**
 * Cached introspection per project schema. Any admin route that runs DDL against a project
 * MUST call invalidateProjectSchema() for that project afterwards, or the data API / codegen
 * will keep serving a stale view of the schema.
 */
export async function getProjectSchema(schemaName: string): Promise<DatabaseSchema> {
  const cached = cache.get(schemaName);
  if (cached) return cached;
  const schema = await introspectSchema(controlPool, schemaName);
  cache.set(schemaName, schema);
  return schema;
}

export async function refreshProjectSchema(schemaName: string): Promise<DatabaseSchema> {
  const schema = await introspectSchema(controlPool, schemaName);
  cache.set(schemaName, schema);
  return schema;
}

export function invalidateProjectSchema(schemaName: string): void {
  cache.delete(schemaName);
}
