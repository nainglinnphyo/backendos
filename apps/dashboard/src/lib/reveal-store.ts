import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Freshly-issued API keys must be shown to the user exactly once and never stored in plaintext.
 * Server Actions can't return values straight to a redirect target, so we stash the plaintext
 * behind a random one-time token for the single following page load, then discard it.
 *
 * In-memory only - fine for a single-instance dev/admin dashboard. A multi-instance deployment
 * would swap this for a short-TTL entry in a shared cache (e.g. Redis) instead.
 */
const pending = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [token, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(token);
  }
}

export function stashReveal(value: string): string {
  sweep();
  const token = randomUUID();
  pending.set(token, { value, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function takeReveal(token: string | undefined): string | null {
  if (!token) return null;
  const entry = pending.get(token);
  pending.delete(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}
