import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as ddl from "@backendos/schema-engine";
import type { DatabaseSchema } from "@backendos/schema-engine";
import { requireAdmin } from "../../middleware/admin-auth.js";
import * as Projects from "../../repositories/projects.repo.js";
import { withTransaction } from "../../db/pool.js";
import { Errors, fromPgError } from "../../lib/errors.js";
import { getProjectSchema, refreshProjectSchema } from "../../lib/schema-cache.js";
import type { Project } from "../../repositories/projects.repo.js";

const columnType = z.enum([
  "uuid",
  "text",
  "varchar",
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "real",
  "double precision",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "json",
  "jsonb",
]);

const defaultValue = z
  .union([
    z.object({ kind: z.literal("literal"), value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }),
    z.object({ kind: z.literal("expression"), value: z.string() }),
  ])
  .nullable();

const createColumnSchema = z.object({
  name: z.string().min(1).max(63),
  type: columnType,
  length: z.number().int().positive().optional(),
  precision: z.number().int().positive().optional(),
  scale: z.number().int().min(0).optional(),
  nullable: z.boolean().optional(),
  default: defaultValue.optional(),
  primaryKey: z.boolean().optional(),
  unique: z.boolean().optional(),
});

const createTableSchema = z.object({
  name: z.string().min(1).max(63),
  columns: z.array(createColumnSchema).min(1),
});

const alterColumnSchema = z.object({
  newName: z.string().min(1).max(63).optional(),
  type: columnType.optional(),
  length: z.number().int().positive().optional(),
  precision: z.number().int().positive().optional(),
  scale: z.number().int().min(0).optional(),
  nullable: z.boolean().optional(),
  default: defaultValue.optional(),
});

const renameSchema = z.object({ name: z.string().min(1).max(63) });

const fkAction = z.enum(["cascade", "set null", "restrict", "no action", "set default"]);

const foreignKeySchema = z.object({
  name: z.string().optional(),
  columns: z.array(z.string()).min(1),
  referencedTable: z.string(),
  referencedColumns: z.array(z.string()).min(1),
  onDelete: fkAction.optional(),
  onUpdate: fkAction.optional(),
});

const uniqueConstraintSchema = z.object({
  name: z.string().optional(),
  columns: z.array(z.string()).min(1),
});

const indexInputSchema = z.object({
  name: z.string().optional(),
  columns: z.array(z.string()).min(1),
  unique: z.boolean().optional(),
  method: z.enum(["btree", "gin", "gist", "hash"]).optional(),
});

async function loadProject(id: string): Promise<Project> {
  const project = await Projects.getProjectById(id);
  if (!project) throw Errors.notFound("Project not found");
  return project;
}

function findTableOrThrow(schema: DatabaseSchema, name: string) {
  const table = schema.tables.find((t) => t.name === name);
  if (!table) throw Errors.notFound(`Table "${name}" not found`);
  return table;
}

/** Runs a DDL mutation in a transaction, re-introspects, and returns the fresh table. */
async function mutateAndReload(project: Project, tableName: string, fn: (client: Parameters<typeof ddl.createTable>[0]) => Promise<void>) {
  try {
    await withTransaction((client) => fn(client));
  } catch (err) {
    throw fromPgError(err);
  }
  const schema = await refreshProjectSchema(project.schemaName);
  return findTableOrThrow(schema, tableName);
}

export async function tablesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/admin/projects/:id/tables", async (req) => {
    const project = await loadProject((req.params as { id: string }).id);
    const schema = await refreshProjectSchema(project.schemaName);
    return { data: schema.tables };
  });

  app.get("/admin/projects/:id/tables/:table", async (req) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const schema = await getProjectSchema(project.schemaName);
    return { data: findTableOrThrow(schema, table) };
  });

  app.post("/admin/projects/:id/tables", async (req, reply) => {
    const project = await loadProject((req.params as { id: string }).id);
    const input = createTableSchema.parse(req.body);
    const table = await mutateAndReload(project, input.name, (client) => ddl.createTable(client, project.schemaName, input));
    reply.code(201);
    return { data: table };
  });

  app.patch("/admin/projects/:id/tables/:table", async (req) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const body = renameSchema.parse(req.body);
    const updated = await mutateAndReload(project, body.name, (client) => ddl.renameTable(client, project.schemaName, table, body.name));
    return { data: updated };
  });

  app.delete("/admin/projects/:id/tables/:table", async (req, reply) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    try {
      await withTransaction((client) => ddl.dropTable(client, project.schemaName, table));
    } catch (err) {
      throw fromPgError(err);
    }
    await refreshProjectSchema(project.schemaName);
    reply.code(204);
    return null;
  });

  app.post("/admin/projects/:id/tables/:table/columns", async (req, reply) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const input = createColumnSchema.parse(req.body);
    const updated = await mutateAndReload(project, table, (client) => ddl.addColumn(client, project.schemaName, table, input));
    reply.code(201);
    return { data: updated };
  });

  app.patch("/admin/projects/:id/tables/:table/columns/:column", async (req) => {
    const { id, table, column } = req.params as { id: string; table: string; column: string };
    const project = await loadProject(id);
    const input = alterColumnSchema.parse(req.body);
    const updated = await mutateAndReload(project, input.newName ?? table, (client) =>
      ddl.alterColumn(client, project.schemaName, table, column, input),
    );
    return { data: updated };
  });

  app.delete("/admin/projects/:id/tables/:table/columns/:column", async (req) => {
    const { id, table, column } = req.params as { id: string; table: string; column: string };
    const project = await loadProject(id);
    const updated = await mutateAndReload(project, table, (client) => ddl.dropColumn(client, project.schemaName, table, column));
    return { data: updated };
  });

  app.post("/admin/projects/:id/tables/:table/unique-constraints", async (req, reply) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const input = uniqueConstraintSchema.parse(req.body);
    const updated = await mutateAndReload(project, table, (client) => ddl.addUniqueConstraint(client, project.schemaName, table, input));
    reply.code(201);
    return { data: updated };
  });

  app.post("/admin/projects/:id/tables/:table/foreign-keys", async (req, reply) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const input = foreignKeySchema.parse(req.body);
    const updated = await mutateAndReload(project, table, (client) => ddl.addForeignKey(client, project.schemaName, table, input));
    reply.code(201);
    return { data: updated };
  });

  app.delete("/admin/projects/:id/tables/:table/constraints/:name", async (req) => {
    const { id, table, name } = req.params as { id: string; table: string; name: string };
    const project = await loadProject(id);
    const updated = await mutateAndReload(project, table, (client) => ddl.dropConstraint(client, project.schemaName, table, name));
    return { data: updated };
  });

  app.post("/admin/projects/:id/tables/:table/indexes", async (req, reply) => {
    const { id, table } = req.params as { id: string; table: string };
    const project = await loadProject(id);
    const input = indexInputSchema.parse(req.body);
    const updated = await mutateAndReload(project, table, (client) => ddl.createIndex(client, project.schemaName, table, input));
    reply.code(201);
    return { data: updated };
  });

  app.delete("/admin/projects/:id/tables/:table/indexes/:name", async (req) => {
    const { id, table, name } = req.params as { id: string; table: string; name: string };
    const project = await loadProject(id);
    const updated = await mutateAndReload(project, table, (client) => ddl.dropIndex(client, project.schemaName, name));
    return { data: updated };
  });
}
