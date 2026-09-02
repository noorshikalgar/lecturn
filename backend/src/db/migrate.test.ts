import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { db } from "./client.js";
import { certificateIssuances } from "./schema.js";
import { createCourse } from "./repositories/coursesRepo.js";
import { getCertificateIssuance, insertCertificateIssuance } from "./repositories/certificateIssuancesRepo.js";
import { signCertificate, verifyCertificateSignature } from "../utils/certificateSigning.js";
import { resignCertificatesIfIdsChanged } from "./migrate.js";

describe("resignCertificatesIfIdsChanged", () => {
  buildTestApp();

  it("is a no-op for a certificate whose signature already matches its stored fields", () => {
    const { userId } = createAndLoginUser("user");
    const course = createCourse({
      folderPath: `/test-courses/resign-noop-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Resign no-op test course",
      description: null,
      topLevelFolder: null,
    });
    const fields = {
      code: `TEST-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      courseId: course.id,
      recipientName: "Test User",
      courseTitle: course.title,
      completedAt: new Date().toISOString(),
      issuedAt: new Date().toISOString(),
    };
    insertCertificateIssuance({ ...fields, signature: signCertificate(fields) });

    const before = getCertificateIssuance(userId, course.id)!;
    resignCertificatesIfIdsChanged();
    const after = getCertificateIssuance(userId, course.id)!;

    // Ed25519 signing is deterministic — an already-valid row's signature
    // must come out byte-for-byte identical, not just "still valid".
    expect(after.signature).toBe(before.signature);
  });

  it("re-signs a certificate whose courseId changed under a migration, restoring verification", () => {
    const { userId } = createAndLoginUser("user");
    const course = createCourse({
      folderPath: `/test-courses/resign-fix-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Resign fix test course",
      description: null,
      topLevelFolder: null,
    });
    const fields = {
      code: `TEST-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      courseId: course.id,
      recipientName: "Test User",
      courseTitle: course.title,
      completedAt: new Date().toISOString(),
      issuedAt: new Date().toISOString(),
    };
    const issued = insertCertificateIssuance({ ...fields, signature: signCertificate(fields) });

    // Simulate exactly what the UUID-reassigning migration does to an
    // already-issued certificate: its courseId changes at the DB layer
    // (here, to another real course id so the FK stays satisfied — the
    // actual migration reassigns courses.id and certificate_issuances.
    // course_id together), but the stored signature was computed over the
    // old value.
    const reassignedCourse = createCourse({
      folderPath: `/test-courses/resign-fix-reassigned-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Reassigned course",
      description: null,
      topLevelFolder: null,
    });
    db.update(certificateIssuances).set({ courseId: reassignedCourse.id }).where(eq(certificateIssuances.id, issued.id)).run();

    const stale = db.select().from(certificateIssuances).where(eq(certificateIssuances.id, issued.id)).get()!;
    expect(verifyCertificateSignature(stale, stale.signature)).toBe(false);

    resignCertificatesIfIdsChanged();

    const healed = db.select().from(certificateIssuances).where(eq(certificateIssuances.id, issued.id)).get()!;
    expect(verifyCertificateSignature(healed, healed.signature)).toBe(true);
    expect(healed.signature).not.toBe(stale.signature);
  });
});
