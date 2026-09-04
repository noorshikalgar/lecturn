import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { certificateIssuances } from "../schema.js";

export function getCertificateIssuance(userId: string, courseId: string) {
  return db
    .select()
    .from(certificateIssuances)
    .where(and(eq(certificateIssuances.userId, userId), eq(certificateIssuances.courseId, courseId)))
    .get();
}

export function getCertificateIssuanceByCode(code: string) {
  return db.select().from(certificateIssuances).where(eq(certificateIssuances.code, code)).get();
}

export function listAllCertificateIssuances() {
  return db.select().from(certificateIssuances).all();
}

// Ed25519 signing is deterministic (same key + same message -> same bytes
// every time), so re-signing with unchanged field values is a no-op write —
// safe to call unconditionally. Exists for resignCertificatesIfIdsChanged in
// migrate.ts: a migration that assigns every row a new id (see the UUID
// primary-key migration) changes the userId/courseId values a certificate's
// signature covers, which would otherwise make every previously-issued
// certificate fail verification even though nothing about its legitimacy
// changed.
export function updateCertificateSignature(id: string, signature: string) {
  db.update(certificateIssuances).set({ signature }).where(eq(certificateIssuances.id, id)).run();
}

export function insertCertificateIssuance(input: {
  code: string;
  userId: string;
  courseId: string;
  recipientName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
  signature: string;
}) {
  // (userId, courseId) is uniquely indexed — a race between two requests
  // both issuing the same user's certificate for the same course at once
  // (e.g. two tabs open) raises a constraint error here rather than
  // silently minting two differently-coded, differently-signed
  // certificates for the same completion. The route layer re-reads on
  // conflict rather than trying to handle that error inline.
  return db.insert(certificateIssuances).values(input).returning().get();
}
