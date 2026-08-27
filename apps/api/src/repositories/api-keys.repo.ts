import { controlPool } from "../db/pool.js";
import { generateApiKey, hashApiKey, type GeneratedApiKey } from "../lib/api-keys.js";
import type { Project } from "./projects.repo.js";
import { getProjectById } from "./projects.repo.js";

export interface ApiKeyRow {
  id: string;
  project_id: string;
  name: string;
  display_prefix: string;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  displayPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    displayPrefix: row.display_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export async function createApiKey(projectId: string, name = "default"): Promise<{ summary: ApiKeySummary; plaintext: string }> {
  const generated: GeneratedApiKey = generateApiKey();
  const res = await controlPool.query<ApiKeyRow>(
    `INSERT INTO backendos_meta.api_keys (project_id, name, display_prefix, key_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [projectId, name, generated.displayPrefix, generated.hash],
  );
  return { summary: toSummary(res.rows[0]!), plaintext: generated.plaintext };
}

export async function listApiKeys(projectId: string): Promise<ApiKeySummary[]> {
  const res = await controlPool.query<ApiKeyRow>(
    `SELECT * FROM backendos_meta.api_keys WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return res.rows.map(toSummary);
}

export async function revokeApiKey(projectId: string, keyId: string): Promise<boolean> {
  const res = await controlPool.query(
    `UPDATE backendos_meta.api_keys SET revoked_at = now() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`,
    [keyId, projectId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function regenerateApiKey(
  projectId: string,
  keyId: string,
): Promise<{ summary: ApiKeySummary; plaintext: string } | null> {
  const existing = await controlPool.query<ApiKeyRow>(
    `SELECT * FROM backendos_meta.api_keys WHERE id = $1 AND project_id = $2`,
    [keyId, projectId],
  );
  const row = existing.rows[0];
  if (!row) return null;

  await controlPool.query(`UPDATE backendos_meta.api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [keyId]);
  return createApiKey(projectId, row.name);
}

export interface AuthenticatedProject {
  project: Project;
  apiKeyId: string;
}

/** Resolves an incoming plaintext API key to the project it belongs to. Returns null if invalid/revoked. */
export async function resolveProjectByApiKey(plaintextKey: string): Promise<AuthenticatedProject | null> {
  const hash = hashApiKey(plaintextKey);
  const res = await controlPool.query<ApiKeyRow>(
    `SELECT * FROM backendos_meta.api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash],
  );
  const row = res.rows[0];
  if (!row) return null;

  const project = await getProjectById(row.project_id);
  if (!project) return null;

  // Best-effort, non-blocking last-used timestamp update.
  controlPool
    .query(`UPDATE backendos_meta.api_keys SET last_used_at = now() WHERE id = $1`, [row.id])
    .catch(() => {});

  return { project, apiKeyId: row.id };
}
