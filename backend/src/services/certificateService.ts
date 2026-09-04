import { randomBytes } from "node:crypto";
import type { CertificateVerification, CourseCertificate } from "@lecturn/shared";
import { getCourseById, withVideoCounts } from "../db/repositories/coursesRepo.js";
import {
  getCertificateIssuance,
  getCertificateIssuanceByCode,
  insertCertificateIssuance,
} from "../db/repositories/certificateIssuancesRepo.js";
import { listProgressForCourse } from "../db/repositories/progressRepo.js";
import { getUserById } from "../db/repositories/usersRepo.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { CERTIFICATE_ISSUER, signCertificate, verifyCertificateSignature, type CertificateFields } from "../utils/certificateSigning.js";

type IssuanceRow = NonNullable<ReturnType<typeof getCertificateIssuance>>;

// Excludes 0/O/1/I — a code that's read aloud or hand-typed from a printed
// certificate shouldn't hinge on telling those apart. 256 % 32 === 0, so
// picking a byte mod 32 has no bias toward any one character.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodeSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function generateCertificateCode(): string {
  return `LECTURN-${randomCodeSegment(5)}-${randomCodeSegment(5)}`;
}

function toFields(row: IssuanceRow): CertificateFields {
  return {
    code: row.code,
    userId: row.userId,
    courseId: row.courseId,
    recipientName: row.recipientName,
    courseTitle: row.courseTitle,
    completedAt: row.completedAt,
    issuedAt: row.issuedAt,
  };
}

function toApiShape(row: IssuanceRow): CourseCertificate {
  return {
    code: row.code,
    recipientName: row.recipientName,
    courseTitle: row.courseTitle,
    completedAt: row.completedAt,
    issuedAt: row.issuedAt,
  };
}

/** Returns this user's certificate for a course, issuing (signing +
 * persisting) a new one the first time it's requested — completion itself
 * is never taken on the caller's word, it's recomputed server-side the same
 * way the dashboard's own "completed" badge is (see withVideoCounts), so a
 * certificate can't be minted for a course that isn't actually finished. */
export function getOrIssueCertificate(userId: string, courseId: string): CourseCertificate {
  const existing = getCertificateIssuance(userId, courseId);
  if (existing) return toApiShape(existing);

  const course = getCourseById(courseId);
  if (!course) throw new ApiHttpError(404, "not_found", "Course not found");

  const [{ completedByUser }] = withVideoCounts([course], userId);
  if (!completedByUser) {
    throw new ApiHttpError(409, "not_completed", "This course isn't fully completed yet");
  }

  const user = getUserById(userId);
  if (!user) throw new ApiHttpError(404, "not_found", "User not found");

  // The most recent completed-video timestamp stands in for "when the user
  // finished the course" — there's no single stored per-user completion
  // event anywhere else in the app (see CoursePage.hooks.ts), this mirrors
  // exactly what it already derives client-side for the same purpose.
  const completedRows = listProgressForCourse(userId, courseId).filter((p) => p.completed);
  const completedAt = completedRows.reduce(
    (latest, p) => (p.lastWatchedAt > latest ? p.lastWatchedAt : latest),
    completedRows[0]?.lastWatchedAt ?? new Date().toISOString(),
  );

  const fields: CertificateFields = {
    code: generateCertificateCode(),
    userId,
    courseId,
    recipientName: user.username,
    courseTitle: course.title,
    completedAt,
    issuedAt: new Date().toISOString(),
  };
  const signature = signCertificate(fields);

  try {
    const issuance = insertCertificateIssuance({ ...fields, signature });
    logActivity({
      type: "certificate_issued",
      actorUserId: userId,
      targetType: "course",
      targetId: courseId,
      message: `${user.username} completed "${course.title}" and was issued a certificate`,
    });
    return toApiShape(issuance);
  } catch (err) {
    // Lost a race with a concurrent request issuing the same (userId,
    // courseId) certificate (e.g. two tabs) — the unique index rejected
    // this insert, so return the one that actually won instead of erroring.
    const row = getCertificateIssuance(userId, courseId);
    if (row) return toApiShape(row);
    throw err;
  }
}

export function verifyCertificateCode(code: string): CertificateVerification {
  const row = getCertificateIssuanceByCode(code);
  if (!row || !verifyCertificateSignature(toFields(row), row.signature)) {
    return { valid: false, certificate: null };
  }
  return {
    valid: true,
    certificate: {
      code: row.code,
      recipientName: row.recipientName,
      courseTitle: row.courseTitle,
      completedAt: row.completedAt,
      issuedAt: row.issuedAt,
      issuer: CERTIFICATE_ISSUER,
    },
  };
}
