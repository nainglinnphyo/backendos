import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../middleware/admin-auth.js";
import * as Projects from "../../repositories/projects.repo.js";
import * as ApiKeys from "../../repositories/api-keys.repo.js";
import { Errors } from "../../lib/errors.js";

const createKeySchema = z.object({ name: z.string().min(1).max(60).optional() });

async function loadProject(id: string) {
  const project = await Projects.getProjectById(id);
  if (!project) throw Errors.notFound("Project not found");
  return project;
}

export async function apiKeysRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/admin/projects/:id/api-keys", async (req) => {
    const { id } = req.params as { id: string };
    await loadProject(id);
    return { data: await ApiKeys.listApiKeys(id) };
  });

  app.post("/admin/projects/:id/api-keys", async (req, reply) => {
    const { id } = req.params as { id: string };
    await loadProject(id);
    const body = createKeySchema.parse(req.body ?? {});
    const { summary, plaintext } = await ApiKeys.createApiKey(id, body.name ?? "default");
    reply.code(201);
    return { data: { ...summary, key: plaintext, note: "This is the only time the full key is shown." } };
  });

  app.delete("/admin/projects/:id/api-keys/:keyId", async (req, reply) => {
    const { id, keyId } = req.params as { id: string; keyId: string };
    await loadProject(id);
    const ok = await ApiKeys.revokeApiKey(id, keyId);
    if (!ok) throw Errors.notFound("API key not found or already revoked");
    reply.code(204);
    return null;
  });

  app.post("/admin/projects/:id/api-keys/:keyId/regenerate", async (req) => {
    const { id, keyId } = req.params as { id: string; keyId: string };
    await loadProject(id);
    const result = await ApiKeys.regenerateApiKey(id, keyId);
    if (!result) throw Errors.notFound("API key not found");
    return { data: { ...result.summary, key: result.plaintext, note: "This is the only time the full key is shown." } };
  });
}
