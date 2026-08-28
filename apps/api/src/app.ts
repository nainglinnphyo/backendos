import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { ApiError } from "./lib/errors.js";
import { healthRoutes } from "./routes/health.routes.js";
import { projectsRoutes } from "./routes/admin/projects.routes.js";
import { apiKeysRoutes } from "./routes/admin/api-keys.routes.js";
import { tablesRoutes } from "./routes/admin/tables.routes.js";
import { dataRoutes } from "./routes/data/data.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof ZodError) {
      reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.issues } });
      return;
    }
    // Framework-level errors (malformed JSON, empty body with a JSON content-type, payload too
    // large, etc.) already carry the right client-error status - surface it instead of masking
    // every non-ApiError as a generic 500.
    const frameworkErr = err as { statusCode?: number; code?: string; message?: string };
    if (typeof frameworkErr.statusCode === "number" && frameworkErr.statusCode >= 400 && frameworkErr.statusCode < 500) {
      reply
        .status(frameworkErr.statusCode)
        .send({ error: { code: frameworkErr.code ?? "BAD_REQUEST", message: frameworkErr.message ?? "Bad request" } });
      return;
    }
    app.log.error(err);
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });

  await app.register(healthRoutes);
  await app.register(projectsRoutes);
  await app.register(apiKeysRoutes);
  await app.register(tablesRoutes);
  await app.register(dataRoutes);

  return app;
}
