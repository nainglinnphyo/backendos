import type { FastifyRequest } from "fastify";
import { getUserForSessionToken } from "../repositories/sessions.repo.js";
import type { AuthUser } from "../repositories/users.repo.js";
import { Errors } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Authenticates a dashboard request by its session token (issued at login/signup). This is a
 * real per-account login for the BackendOS dashboard itself - separate from a project's own API
 * key, which just identifies a project for data-plane requests and has nothing to do with who's
 * logged into the dashboard.
 */
export async function requireUser(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) throw Errors.unauthorized("Not signed in");

  const user = await getUserForSessionToken(token);
  if (!user) throw Errors.unauthorized("Session expired or invalid - please sign in again");

  request.user = user;
}
