import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { sectionAccess } from "../schema.js";

export function getSectionAccessUserIds(sectionId: number): number[] {
  return db
    .select({ userId: sectionAccess.userId })
    .from(sectionAccess)
    .where(eq(sectionAccess.sectionId, sectionId))
    .all()
    .map((r) => r.userId);
}

export function setSectionAccess(sectionId: number, userIds: number[]) {
  db.delete(sectionAccess).where(eq(sectionAccess.sectionId, sectionId)).run();
  if (userIds.length > 0) {
    db.insert(sectionAccess)
      .values(userIds.map((userId) => ({ sectionId, userId })))
      .run();
  }
}

// Ids of every section that has at least one access row — i.e. every section
// that is NOT public. Sections absent from this set have no restriction.
export function listRestrictedSectionIds(): Set<number> {
  return new Set(db.selectDistinct({ sectionId: sectionAccess.sectionId }).from(sectionAccess).all().map((r) => r.sectionId));
}

export function listAllowedSectionIdsForUser(userId: number): Set<number> {
  return new Set(
    db.select({ sectionId: sectionAccess.sectionId }).from(sectionAccess).where(eq(sectionAccess.userId, userId)).all().map((r) => r.sectionId),
  );
}
