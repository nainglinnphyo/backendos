import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { Errors } from "../lib/errors.js";
import { requireUser } from "../middleware/require-user.js";
import { countUsers, createUser, getUserRowByEmail, claimOrphanProjects } from "../repositories/users.repo.js";
import { createSession, deleteSessionByToken } from "../repositories/sessions.repo.js";
import { countProjectsForOwner } from "../repositories/projects.repo.js";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const { email, password } = credentialsSchema.parse(req.body);

    const existing = await getUserRowByEmail(email);
    if (existing) throw Errors.conflict("An account with this email already exists");

    const isFirstUser = (await countUsers()) === 0;
    const user = await createUser(email, await hashPassword(password));
    if (isFirstUser) {
      // Solo-dev convenience: projects created before accounts existed shouldn't just vanish.
      await claimOrphanProjects(user.id);
    }

    const session = await createSession(user.id);
    reply.code(201);
    return { data: { user, token: session.plaintext, expiresAt: session.expiresAt } };
  });

  app.post("/auth/login", async (req) => {
    const { email, password } = credentialsSchema.parse(req.body);

    const row = await getUserRowByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw Errors.unauthorized("Invalid email or password");
    }

    const session = await createSession(row.id);
    return {
      data: {
        user: { id: row.id, email: row.email, maxProjects: row.max_projects, createdAt: row.created_at },
        token: session.plaintext,
        expiresAt: session.expiresAt,
      },
    };
  });

  app.post("/auth/logout", async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (token) await deleteSessionByToken(token);
    reply.code(204);
    return null;
  });

  app.get("/auth/me", { preHandler: requireUser }, async (req) => {
    const user = req.user!;
    const projectCount = await countProjectsForOwner(user.id);
    return { data: { ...user, projectCount } };
  });
}
