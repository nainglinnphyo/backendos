import type { FastifyInstance } from "fastify";
import { controlPool } from "../db/pool.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    await controlPool.query("SELECT 1");
    return { data: { status: "ok" } };
  });
}
