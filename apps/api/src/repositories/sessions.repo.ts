import { controlPool } from "../db/pool.js";
import { generateSessionToken, hashSessionToken } from "../lib/session-tokens.js";
import { toUser, type AuthUser, type UserRow } from "./users.repo.js";

export async function createSession(userId: string): Promise<{ plaintext: string; expiresAt: Date }> {
  const { plaintext, hash, expiresAt } = generateSessionToken();
  await controlPool.query(
    `INSERT INTO backendos_meta.sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt],
  );
  return { plaintext, expiresAt };
}

/** Resolves a plaintext session token to its user, if the session exists and hasn't expired. */
export async function getUserForSessionToken(plaintextToken: string): Promise<AuthUser | null> {
  const hash = hashSessionToken(plaintextToken);
  const res = await controlPool.query<UserRow>(
    `SELECT u.* FROM backendos_meta.sessions s
     JOIN backendos_meta.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hash],
  );
  return res.rows[0] ? toUser(res.rows[0]) : null;
}

export async function deleteSessionByToken(plaintextToken: string): Promise<void> {
  const hash = hashSessionToken(plaintextToken);
  await controlPool.query(`DELETE FROM backendos_meta.sessions WHERE token_hash = $1`, [hash]);
}
