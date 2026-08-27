import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt's memory cost is roughly 128 * N * r bytes — Node's default scrypt
// maxmem (32MB) is well under what N=131072 needs, so it must be raised
// explicitly or scryptSync throws.
const CURRENT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

// Hashes created before this cost bump have no prefix at all (just the raw
// hex digest) — treated as N=16384, Node's old scryptSync default, so
// existing accounts can still log in. New hashes are versioned so a future
// cost bump can do the same thing again without a migration.
const LEGACY_N = 16384;

function scryptParamsFor(storedHash: string): { n: number; hex: string } {
  const match = /^scrypt\$(\d+)\$([0-9a-f]+)$/.exec(storedHash);
  if (match) return { n: Number(match[1]), hex: match[2] };
  return { n: LEGACY_N, hex: storedHash };
}

function deriveKey(password: string, salt: string, n: number): Buffer {
  return scryptSync(password, salt, 64, { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt$${CURRENT_N}$${deriveKey(password, salt, CURRENT_N).toString("hex")}`;
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { n, hex } = scryptParamsFor(hash);
  const candidate = deriveKey(password, salt, n);
  const stored = Buffer.from(hex, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** True when a verified password's hash was created under the old (weaker)
 * cost — lets the caller opportunistically re-hash at the current cost
 * right after a successful login, without ever storing two different
 * formats for reasons other than "haven't logged in since the upgrade". */
export function needsRehash(hash: string): boolean {
  return scryptParamsFor(hash).n < CURRENT_N;
}
