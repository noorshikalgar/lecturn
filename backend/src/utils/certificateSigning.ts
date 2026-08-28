import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface CertificateFields {
  code: string;
  userId: number;
  courseId: number;
  recipientName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}

export const CERTIFICATE_ISSUER = "Lecturn";

// A stable field order so the exact same bytes get signed and verified —
// object key order isn't semantically meaningful in JSON, but JSON.stringify
// only produces identical output across calls if we don't rely on whatever
// order properties happened to be set in.
function canonicalPayload(fields: CertificateFields): string {
  return JSON.stringify({
    code: fields.code,
    userId: fields.userId,
    courseId: fields.courseId,
    recipientName: fields.recipientName,
    courseTitle: fields.courseTitle,
    completedAt: fields.completedAt,
    issuedAt: fields.issuedAt,
    issuer: CERTIFICATE_ISSUER,
  });
}

let cachedPrivateKey: KeyObject | undefined;

// Ed25519 rather than an HMAC: a certificate's signature needs to be
// checkable by anyone holding only the *public* key (a prospective
// employer, e.g.), not just by this server holding the same shared secret
// it signed with. No env var is required to get this working — self-hosted
// admins who don't set CERTIFICATE_SIGNING_PRIVATE_KEY get a key generated
// once and persisted next to the SQLite DB, so certificates stay verifiable
// across restarts without any setup step.
function loadOrCreatePrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;

  if (env.CERTIFICATE_SIGNING_PRIVATE_KEY) {
    cachedPrivateKey = createPrivateKey(env.CERTIFICATE_SIGNING_PRIVATE_KEY);
    return cachedPrivateKey;
  }

  // DB_PATH is ":memory:" in tests — not a real directory, so fall back to
  // the default data dir rather than dropping the key file at cwd's root.
  const dataDir = env.DB_PATH === ":memory:" ? "./data" : dirname(env.DB_PATH);
  const keyPath = join(dataDir, "certificate_signing_key.pem");
  if (existsSync(keyPath)) {
    cachedPrivateKey = createPrivateKey(readFileSync(keyPath, "utf-8"));
    return cachedPrivateKey;
  }

  logger.warn({ keyPath }, "No CERTIFICATE_SIGNING_PRIVATE_KEY configured — generating and persisting a new Ed25519 certificate-signing key");
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, pem, { mode: 0o600 });
  cachedPrivateKey = privateKey;
  return privateKey;
}

export function signCertificate(fields: CertificateFields): string {
  const payload = Buffer.from(canonicalPayload(fields), "utf-8");
  // `algorithm` must be null for Ed25519/Ed448 keys — the curve signs the
  // message directly rather than a caller-chosen digest of it.
  return sign(null, payload, loadOrCreatePrivateKey()).toString("base64");
}

export function verifyCertificateSignature(fields: CertificateFields, signature: string): boolean {
  const publicKey = createPublicKey(loadOrCreatePrivateKey());
  const payload = Buffer.from(canonicalPayload(fields), "utf-8");
  try {
    return verify(null, payload, publicKey, Buffer.from(signature, "base64"));
  } catch {
    // A malformed base64/signature blob is "not valid", not a crash.
    return false;
  }
}

export function getCertificatePublicKeyPem(): string {
  return createPublicKey(loadOrCreatePrivateKey()).export({ type: "spki", format: "pem" }) as string;
}
