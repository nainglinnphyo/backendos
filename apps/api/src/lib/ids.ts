import { randomBytes } from "node:crypto";

/** Immutable internal schema name for a project, decoupled from its (renamable) slug. */
export function generateSchemaName(): string {
  return `proj_${randomBytes(10).toString("hex")}`;
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "project";
}
