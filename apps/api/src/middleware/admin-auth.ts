import type { FastifyRequest } from "fastify";
import { config } from "../config.js";
import { safeEqual } from "../lib/api-keys.js";
import { Errors } from "../lib/errors.js";

/**
 * Guards the /admin/* dashboard API. This is a single operator secret, not end-user auth
 * (out of scope for v1) - it just stops the project/table management API from being wide open.
 */
export async function requireAdmin(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const key = bearer ?? (request.headers["x-backendos-admin-key"] as string | undefined);

  if (!key || !safeEqual(key, config.adminApiKey)) {
    throw Errors.unauthorized("Missing or invalid admin key");
  }
}
