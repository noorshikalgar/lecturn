import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { certificates } from "../schema.js";

export function getCertificateForCourse(courseId: string) {
  return db.select().from(certificates).where(eq(certificates.courseId, courseId)).get();
}

export function upsertCertificate(courseId: string, filePath: string) {
  const existing = getCertificateForCourse(courseId);
  if (existing) {
    db.update(certificates).set({ filePath, uploadedAt: new Date().toISOString() }).where(eq(certificates.id, existing.id)).run();
    return getCertificateForCourse(courseId)!;
  }
  return db.insert(certificates).values({ courseId, filePath }).returning().get();
}

export function deleteCertificate(courseId: string) {
  db.delete(certificates).where(eq(certificates.courseId, courseId)).run();
}
