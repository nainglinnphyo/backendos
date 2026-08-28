import { controlPool } from "../db/pool.js";
import { config } from "../config.js";

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  status: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  url: string;
  schemaName: string;
  status: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    url: `${config.publicApiBaseUrl}/p/${row.slug}`,
    schemaName: row.schema_name,
    status: row.status,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertProject(name: string, slug: string, schemaName: string, ownerId: string): Promise<Project> {
  const res = await controlPool.query<ProjectRow>(
    `INSERT INTO backendos_meta.projects (name, slug, schema_name, owner_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, schemaName, ownerId],
  );
  return toProject(res.rows[0]!);
}

export async function listProjectsForOwner(ownerId: string): Promise<Project[]> {
  const res = await controlPool.query<ProjectRow>(
    `SELECT * FROM backendos_meta.projects WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  return res.rows.map(toProject);
}

export async function countProjectsForOwner(ownerId: string): Promise<number> {
  const res = await controlPool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM backendos_meta.projects WHERE owner_id = $1`,
    [ownerId],
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const res = await controlPool.query<ProjectRow>(`SELECT * FROM backendos_meta.projects WHERE id = $1`, [id]);
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

/**
 * Looks up a project and checks it belongs to `ownerId` in one step. Returns null for both "no
 * such project" and "exists but belongs to someone else" - callers should 404 either way, never
 * leaking whether a given id belongs to another account.
 */
export async function getProjectForOwner(id: string, ownerId: string): Promise<Project | null> {
  const project = await getProjectById(id);
  if (!project || project.ownerId !== ownerId) return null;
  return project;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const res = await controlPool.query<ProjectRow>(`SELECT * FROM backendos_meta.projects WHERE slug = $1`, [slug]);
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

export async function slugExists(slug: string): Promise<boolean> {
  const res = await controlPool.query(`SELECT 1 FROM backendos_meta.projects WHERE slug = $1`, [slug]);
  return (res.rowCount ?? 0) > 0;
}

export async function renameProject(id: string, name: string): Promise<Project | null> {
  const res = await controlPool.query<ProjectRow>(
    `UPDATE backendos_meta.projects SET name = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, name],
  );
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

export async function deleteProjectRow(id: string): Promise<void> {
  await controlPool.query(`DELETE FROM backendos_meta.projects WHERE id = $1`, [id]);
}

/** Appends -2, -3, ... to a base slug until it's unique. */
export async function generateUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
