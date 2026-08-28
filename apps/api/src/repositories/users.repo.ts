import { controlPool } from "../db/pool.js";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  max_projects: number;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  maxProjects: number;
  createdAt: string;
}

function toUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, maxProjects: row.max_projects, createdAt: row.created_at };
}

export async function countUsers(): Promise<number> {
  const res = await controlPool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM backendos_meta.users`);
  return Number(res.rows[0]?.count ?? 0);
}

export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
  const res = await controlPool.query<UserRow>(
    `INSERT INTO backendos_meta.users (email, password_hash) VALUES ($1, $2) RETURNING *`,
    [email.toLowerCase(), passwordHash],
  );
  return toUser(res.rows[0]!);
}

export async function getUserRowByEmail(email: string): Promise<UserRow | null> {
  const res = await controlPool.query<UserRow>(`SELECT * FROM backendos_meta.users WHERE email = $1`, [email.toLowerCase()]);
  return res.rows[0] ?? null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const res = await controlPool.query<UserRow>(`SELECT * FROM backendos_meta.users WHERE id = $1`, [id]);
  return res.rows[0] ? toUser(res.rows[0]) : null;
}

/**
 * One-time migration convenience: projects created before dashboard accounts existed have no
 * owner. The very first account to ever sign up inherits them, so a solo developer's existing
 * projects don't just vanish once auth is turned on.
 */
export async function claimOrphanProjects(userId: string): Promise<void> {
  await controlPool.query(`UPDATE backendos_meta.projects SET owner_id = $1 WHERE owner_id IS NULL`, [userId]);
}

export { toUser };
