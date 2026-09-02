import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildCount, buildDelete, buildFindMany, QueryValidationError, type TableSchema } from "@backendos/schema-engine";
import { requireUser } from "../../middleware/require-user.js";
import * as Projects from "../../repositories/projects.repo.js";
import type { Project } from "../../repositories/projects.repo.js";
import { getTenantContext } from "../../db/pool.js";
import { Errors, fromPgError } from "../../lib/errors.js";
import { getProjectSchema } from "../../lib/schema-cache.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const scalarValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const deleteRowSchema = z.object({ where: z.record(z.string(), scalarValue) });

async function loadProjectAndTable(id: string, tableName: string, ownerId: string): Promise<{ project: Project; table: TableSchema }> {
  const project = await Projects.getProjectForOwner(id, ownerId);
  if (!project) throw Errors.notFound("Project not found");
  const schema = await getProjectSchema(project.schemaName);
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) throw Errors.notFound(`Table "${tableName}" not found`);
  return { project, table };
}

/** Row browsing/deletion for the dashboard's data grid. Distinct from the /v1/* data-plane API:
 * this is authenticated by the dashboard session (+ project ownership), not a project API key. */
export async function tableDataRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.get("/admin/projects/:id/tables/:table/rows", async (req) => {
    const { id, table: tableName } = req.params as { id: string; table: string };
    const { project, table } = await loadProjectAndTable(id, tableName, req.user!.id);
    const query = listQuerySchema.parse(req.query ?? {});
    const { pool, schemaName } = getTenantContext(project.schemaName);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    try {
      const findSql = buildFindMany(schemaName, table, { limit, offset });
      const countSql = buildCount(schemaName, table, undefined);
      const [rowsResult, countResult] = await Promise.all([
        pool.query(findSql.text, findSql.values),
        pool.query(countSql.text, countSql.values),
      ]);
      return { data: { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0), limit, offset } };
    } catch (err) {
      if (err instanceof QueryValidationError) throw Errors.badRequest(err.message);
      throw fromPgError(err);
    }
  });

  app.post("/admin/projects/:id/tables/:table/rows/delete", async (req) => {
    const { id, table: tableName } = req.params as { id: string; table: string };
    const { project, table } = await loadProjectAndTable(id, tableName, req.user!.id);
    const body = deleteRowSchema.parse(req.body);
    const { pool, schemaName } = getTenantContext(project.schemaName);

    try {
      const sql = buildDelete(schemaName, table, { where: body.where });
      const result = await pool.query(sql.text, sql.values);
      return { data: result.rows };
    } catch (err) {
      if (err instanceof QueryValidationError) throw Errors.badRequest(err.message);
      throw fromPgError(err);
    }
  });
}
