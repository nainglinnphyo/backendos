import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { controlPool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = ["0001_init.sql"];

/** Applies the (idempotent) control-plane migrations. Safe to run on every boot. */
export async function runMigrations(): Promise<void> {
  for (const file of MIGRATIONS) {
    const sql = await readFile(path.join(__dirname, "migrations", file), "utf8");
    await controlPool.query(sql);
  }
}
