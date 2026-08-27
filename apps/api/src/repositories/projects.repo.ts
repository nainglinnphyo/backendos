import { controlPool } from "../db/pool.js";
import { config } from "../config.js";

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  status: string;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertProject(name: string, slug: string, schemaName: string): Promise<Project> {
  const res = await controlPool.query<ProjectRow>(
    `INSERT INTO backendos_meta.projects (name, slug, schema_name) VALUES ($1, $2, $3) RETURNING *`,
    [name, slug, schemaName],
  );
  return toProject(res.rows[0]!);
}

export async function listProjects(): Promise<Project[]> {
  const res = await controlPool.query<ProjectRow>(`SELECT * FROM backendos_meta.projects ORDER BY created_at DESC`);
  return res.rows.map(toProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const res = await controlPool.query<ProjectRow>(`SELECT * FROM backendos_meta.projects WHERE id = $1`, [id]);
  return res.rows[0] ? toProject(res.rows[0]) : null;
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
