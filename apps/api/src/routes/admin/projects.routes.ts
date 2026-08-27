import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSchema, dropSchema } from "@backendos/schema-engine";
import { requireAdmin } from "../../middleware/admin-auth.js";
import * as Projects from "../../repositories/projects.repo.js";
import * as ApiKeys from "../../repositories/api-keys.repo.js";
import { withTransaction } from "../../db/pool.js";
import { generateSchemaName, slugify } from "../../lib/ids.js";
import { Errors } from "../../lib/errors.js";
import { getProjectSchema, invalidateProjectSchema } from "../../lib/schema-cache.js";
import { config } from "../../config.js";

const createProjectSchema = z.object({ name: z.string().min(1).max(100) });
const renameProjectSchema = z.object({ name: z.string().min(1).max(100) });

export async function projectsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.post("/admin/projects", async (req, reply) => {
    const body = createProjectSchema.parse(req.body);
    const slug = await Projects.generateUniqueSlug(slugify(body.name));
    const schemaName = generateSchemaName();

    await withTransaction((client) => createSchema(client, schemaName));

    const project = await Projects.insertProject(body.name, slug, schemaName);
    const { summary, plaintext } = await ApiKeys.createApiKey(project.id, "default");

    reply.code(201);
    return {
      data: {
        project,
        apiKey: {
          ...summary,
          key: plaintext,
          note: "This is the only time the full key is shown. Store it now (e.g. in an env var).",
        },
      },
    };
  });

  app.get("/admin/projects", async () => ({ data: await Projects.listProjects() }));

  app.get("/admin/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const project = await Projects.getProjectById(id);
    if (!project) throw Errors.notFound("Project not found");
    return { data: project };
  });

  app.patch("/admin/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = renameProjectSchema.parse(req.body);
    const project = await Projects.renameProject(id, body.name);
    if (!project) throw Errors.notFound("Project not found");
    return { data: project };
  });

  app.delete("/admin/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await Projects.getProjectById(id);
    if (!project) throw Errors.notFound("Project not found");

    await withTransaction((client) => dropSchema(client, project.schemaName));
    await Projects.deleteProjectRow(id);
    invalidateProjectSchema(project.schemaName);

    reply.code(204);
    return null;
  });

  app.get("/admin/projects/:id/status", async (req) => {
    const { id } = req.params as { id: string };
    const project = await Projects.getProjectById(id);
    if (!project) throw Errors.notFound("Project not found");
    const schema = await getProjectSchema(project.schemaName);
    return {
      data: {
        status: project.status,
        tableCount: schema.tables.length,
        lastIntrospectedAt: schema.generatedAt,
      },
    };
  });

  app.get("/admin/projects/:id/connection", async (req) => {
    const { id } = req.params as { id: string };
    const project = await Projects.getProjectById(id);
    if (!project) throw Errors.notFound("Project not found");

    const dbUrl = new URL(config.databaseUrl);
    return {
      data: {
        isolation: "schema-per-project",
        schemaName: project.schemaName,
        host: dbUrl.hostname,
        port: dbUrl.port || "5432",
        database: dbUrl.pathname.replace(/^\//, ""),
        note: "Direct Postgres access isn't exposed to applications in v1 - connect through the BackendOS API/client using the project URL + access key instead.",
      },
    };
  });
}
