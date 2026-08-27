import type { FastifyRequest } from "fastify";
import { resolveProjectByApiKey } from "../repositories/api-keys.repo.js";
import type { Project } from "../repositories/projects.repo.js";
import { Errors } from "../lib/errors.js";
import { isWellFormedApiKey } from "../lib/api-keys.js";

declare module "fastify" {
  interface FastifyRequest {
    project?: Project;
  }
}

function extractApiKey(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const custom = request.headers["x-backendos-key"];
  return typeof custom === "string" ? custom : undefined;
}

/**
 * Authenticates a data-plane request by its project API key (Authorization: Bearer bko_live_...
 * or x-backendos-key). The key alone identifies the project - no user auth in v1. When the
 * route also carries a :slug param (the "Project URL" path), it must match the key's project,
 * so a key can never be used against a URL that isn't actually its own project's.
 */
export async function requireProject(request: FastifyRequest): Promise<void> {
  const key = extractApiKey(request);
  if (!key || !isWellFormedApiKey(key)) {
    throw Errors.unauthorized("Missing or malformed API key (expected bko_live_...)");
  }

  const resolved = await resolveProjectByApiKey(key);
  if (!resolved) {
    throw Errors.unauthorized("Invalid or revoked API key");
  }

  const params = request.params as Record<string, string | undefined>;
  if (params.slug && params.slug !== resolved.project.slug) {
    throw Errors.unauthorized("This API key does not belong to the project at this URL");
  }

  request.project = resolved.project;
}
