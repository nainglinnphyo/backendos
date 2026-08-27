import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const PREFIX = "bko_live_";
const DISPLAY_PREFIX_LEN = PREFIX.length + 6;

export interface GeneratedApiKey {
  /** Full secret - only ever returned once, right after creation/regeneration. Never persisted. */
  plaintext: string;
  /** sha256 hex digest - this is what gets stored. */
  hash: string;
  /** e.g. "bko_live_ab12cd" - safe to store/display so users can recognize a key later. */
  displayPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${secret}`;
  return { plaintext, hash: hashApiKey(plaintext), displayPrefix: plaintext.slice(0, DISPLAY_PREFIX_LEN) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function isWellFormedApiKey(key: string): boolean {
  return typeof key === "string" && key.startsWith(PREFIX) && key.length > PREFIX.length + 10;
}

/** Constant-time comparison for the single static admin secret (not for per-project keys, which are compared via hash lookup). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
