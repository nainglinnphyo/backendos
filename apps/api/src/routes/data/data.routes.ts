import type { FastifyInstance } from "fastify";
import {
  buildCount,
  buildCreate,
  buildDelete,
  buildFindMany,
  buildFindUnique,
  buildUpdate,
  QueryValidationError,
  type CountQuery,
  type CreateQuery,
  type DeleteQuery,
  type FindManyQuery,
  type FindUniqueQuery,
  type UpdateQuery,
} from "@backendos/schema-engine";
import { requireProject } from "../../middleware/project-auth.js";
import { getProjectSchema } from "../../lib/schema-cache.js";
import { getTenantContext } from "../../db/pool.js";
import { Errors, fromPgError } from "../../lib/errors.js";

const OPERATIONS = new Set(["findMany", "findUnique", "create", "update", "delete", "count"]);

export async function dataRoutes(app: FastifyInstance) {
  // Slug-prefixed form matches the "Project URL" shown in the dashboard, e.g.
  // https://my-app.backendos.dev/v1/users/findMany (in prod, the subdomain resolves here).
  // For local dev without wildcard DNS, projects are reachable at /p/:slug/v1/...
  app.post("/p/:slug/v1/:table/:operation", { preHandler: requireProject }, handleDataRequest);
  // The API key alone is sufficient to identify the project, so the unprefixed form works too.
  app.post("/v1/:table/:operation", { preHandler: requireProject }, handleDataRequest);

  app.get("/p/:slug/v1/schema", { preHandler: requireProject }, handleSchemaRequest);
  app.get("/v1/schema", { preHandler: requireProject }, handleSchemaRequest);
}

async function handleSchemaRequest(req: any) {
  const project = req.project!;
  const schema = await getProjectSchema(project.schemaName);
  return { data: schema };
}

async function handleDataRequest(req: any, reply: any) {
  const { table: tableName, operation } = req.params as { table: string; operation: string };
  if (!OPERATIONS.has(operation)) {
    throw Errors.notFound(`Unknown operation "${operation}"`);
  }

  const project = req.project!;
  const schema = await getProjectSchema(project.schemaName);
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) throw Errors.notFound(`Table "${tableName}" not found`);

  const { pool, schemaName } = getTenantContext(project.schemaName);
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    switch (operation) {
      case "findMany": {
        const sql = buildFindMany(schemaName, table, body as FindManyQuery);
        const result = await pool.query(sql.text, sql.values);
        return { data: result.rows };
      }
      case "findUnique": {
        const query = body as Partial<FindUniqueQuery>;
        if (!query.where) throw Errors.badRequest('findUnique requires a "where"');
        const sql = buildFindUnique(schemaName, table, query.where, query.select);
        const result = await pool.query(sql.text, sql.values);
        return { data: result.rows[0] ?? null };
      }
      case "create": {
        const query = body as Partial<CreateQuery>;
        if (query.data === undefined) throw Errors.badRequest('create requires "data"');
        const sql = buildCreate(schemaName, table, query as CreateQuery);
        const result = await pool.query(sql.text, sql.values);
        reply.code(201);
        return { data: Array.isArray(query.data) ? result.rows : (result.rows[0] ?? null) };
      }
      case "update": {
        const query = body as Partial<UpdateQuery>;
        if (!query.where || query.data === undefined) throw Errors.badRequest('update requires "where" and "data"');
        const sql = buildUpdate(schemaName, table, query as UpdateQuery);
        const result = await pool.query(sql.text, sql.values);
        return { data: result.rows };
      }
      case "delete": {
        const query = body as Partial<DeleteQuery>;
        if (!query.where) throw Errors.badRequest('delete requires "where"');
        const sql = buildDelete(schemaName, table, query as DeleteQuery);
        const result = await pool.query(sql.text, sql.values);
        return { data: result.rows };
      }
      case "count": {
        const query = body as CountQuery;
        const sql = buildCount(schemaName, table, query.where);
        const result = await pool.query(sql.text, sql.values);
        return { data: Number(result.rows[0]?.count ?? 0) };
      }
      default:
        throw Errors.notFound(`Unknown operation "${operation}"`);
    }
  } catch (err) {
    if (err instanceof QueryValidationError) throw Errors.badRequest(err.message);
    if (err && typeof err === "object" && "code" in err && typeof (err as { code?: unknown }).code === "string") {
      throw fromPgError(err);
    }
    throw err;
  }
}
