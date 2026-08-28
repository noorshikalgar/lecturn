import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { certificateIssuances } from "../schema.js";

export function getCertificateIssuance(userId: number, courseId: number) {
  return db
    .select()
    .from(certificateIssuances)
    .where(and(eq(certificateIssuances.userId, userId), eq(certificateIssuances.courseId, courseId)))
    .get();
}

export function getCertificateIssuanceByCode(code: string) {
  return db.select().from(certificateIssuances).where(eq(certificateIssuances.code, code)).get();
}

export function insertCertificateIssuance(input: {
  code: string;
  userId: number;
  courseId: number;
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
