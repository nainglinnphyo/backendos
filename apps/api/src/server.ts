import { buildApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { config } from "./config.js";

async function main() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`BackendOS API listening on ${config.publicApiBaseUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
