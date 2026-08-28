import { randomBytes, createHash } from "node:crypto";

const SESSION_TTL_DAYS = 30;

export interface GeneratedSessionToken {
  /** Only ever returned once, right after login/signup. Never persisted. */
  plaintext: string;
  /** sha256 hex digest - this is what gets stored. */
  hash: string;
  expiresAt: Date;
}

export function generateSessionToken(): GeneratedSessionToken {
  const plaintext = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { plaintext, hash: hashSessionToken(plaintext), expiresAt };
}

export function hashSessionToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
