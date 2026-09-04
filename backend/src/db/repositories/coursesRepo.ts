import { existsSync } from "node:fs";
import { sep } from "node:path";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client.js";
import { courses, nodes, progress } from "../schema.js";

// Card-facing list endpoints show a lesson count and this user's own
// completion alongside duration — cheap to compute in two grouped queries
// rather than a per-course subquery. completedByUser is derived here (from
// this user's own progress rows) rather than trusted from courses.completedAt,
// which is one global flag shared by every user — reading it directly would
// show course B as "Completed" for a user who has never watched a second of
// it, just because some other user finished it first.
export function withVideoCounts<T extends { id: string }>(
  rows: T[],
  userId: string,
): (T & { videoCount: number; completedByUser: boolean })[] {
  if (rows.length === 0) return rows as (T & { videoCount: number; completedByUser: boolean })[];
  const ids = rows.map((r) => r.id);

  const counts = db
    .select({ courseId: nodes.courseId, count: sql<number>`count(*)` })
    .from(nodes)
    // Excludes videos flagged missing by a rescan — otherwise a course's
    // lesson count keeps including files that no longer exist on disk.
    .where(and(eq(nodes.type, "video"), eq(nodes.missing, false), inArray(nodes.courseId, ids)))
    .groupBy(nodes.courseId)
    .all();
  const byCourse = new Map(counts.map((c) => [c.courseId, c.count]));

  const completedCounts = db
    .select({ courseId: nodes.courseId, count: sql<number>`count(*)` })
    .from(progress)
    .innerJoin(nodes, eq(nodes.id, progress.videoNodeId))
    .where(
      and(
        eq(progress.userId, userId),
        eq(progress.completed, true),
        eq(nodes.type, "video"),
        eq(nodes.missing, false),
        inArray(nodes.courseId, ids),
      ),
    )
    .groupBy(nodes.courseId)
    .all();
  const completedByCourse = new Map(completedCounts.map((c) => [c.courseId, c.count]));

  return rows.map((r) => {
    const videoCount = byCourse.get(r.id) ?? 0;
    const completedCount = completedByCourse.get(r.id) ?? 0;
    return { ...r, videoCount, completedByUser: videoCount > 0 && completedCount >= videoCount };
  });
}

export function getCourseByFolderPath(folderPath: string) {
  return db.select().from(courses).where(eq(courses.folderPath, folderPath)).get();
}

export function getCourseById(id: string) {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

// Every listing/search function below excludes a grouped course
// (collectionId set) from its results — once a course joins a collection,
// only the collection is the addressable unit in every browse surface
// (home rows, section grids, search, the admin picker); the course itself
// is still fully real underneath (progress, notes, certs, its own
// /courses/:id), just not independently listed here. See collectionsRepo.ts
// for the parallel "list collections" functions callers pair these with.
export function listCourses(userId: string) {
  return withVideoCounts(db.select().from(courses).where(isNull(courses.collectionId)).orderBy(courses.title).all(), userId);
}

export function listCoursesBySection(sectionId: string, userId: string) {
  return withVideoCounts(
    db
      .select()
      .from(courses)
      .where(and(eq(courses.sectionId, sectionId), isNull(courses.collectionId)))
      .orderBy(courses.title)
      .all(),
    userId,
  );
}

// The one deliberate exception to "grouped courses aren't independently
// listed" — this is exactly how a collection's own detail page finds its
// child courses in the first place.
export function listCoursesByCollection(collectionId: string, userId: string) {
  return withVideoCounts(
    db.select().from(courses).where(eq(courses.collectionId, collectionId)).orderBy(courses.title).all(),
    userId,
  );
}

export function listRecentCourses(userId: string, limit = 20) {
  return withVideoCounts(
    db.select().from(courses).where(isNull(courses.collectionId)).orderBy(desc(courses.createdAt)).limit(limit).all(),
    userId,
  );
}

// SQLite's LIKE is case-insensitive for ASCII by default — no need for a
// LOWER() wrap. % and _ escaped (with an explicit ESCAPE clause, since
// SQLite doesn't apply one by default) so a literal "%" in a search term
// isn't treated as a wildcard.
export function searchCourses(query: string, userId: string, limit = 20) {
  const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
  return withVideoCounts(
    db
      .select()
      .from(courses)
      .where(and(sql`${courses.title} LIKE ${`%${escaped}%`} ESCAPE '\\'`, isNull(courses.collectionId)))
      .orderBy(courses.title)
      .limit(limit)
      .all(),
    userId,
  );
}

export function listUnassignedCourses(userId: string) {
  return withVideoCounts(
    db
      .select()
      .from(courses)
      .where(and(isNull(courses.sectionId), isNull(courses.collectionId)))
      .orderBy(desc(courses.createdAt))
      .all(),
    userId,
  );
}

// Courses aren't tied to a library by a real FK (their identity is
// folderPath) — this finds "belongs to this library" by path prefix instead.
// The trailing separator guards against false positives like /mnt/courses2
// matching a rootPath of /mnt/courses.
export function listCoursesUnderPath(rootPath: string) {
  const prefix = rootPath.endsWith(sep) ? rootPath : rootPath + sep;
  return db
    .select()
    .from(courses)
    .all()
    .filter((c) => c.folderPath.startsWith(prefix));
}

// A course whose folderPath no longer exists on disk — typically because the
// admin renamed or moved the folder outside the app. Computed live (not a
// stored flag) so it self-heals the instant the course is relinked.
export function listOrphanedCoursesForLibrary(rootPath: string) {
  return listCoursesUnderPath(rootPath).filter((c) => !existsSync(c.folderPath));
}

export function createCourse(input: {
  folderPath: string;
  sectionId: string | null;
  title: string;
  description: string | null;
  topLevelFolder: string | null;
}) {
  return db.insert(courses).values(input).returning().get();
}

export function setCourseFolderPath(id: string, folderPath: string) {
  db.update(courses).set({ folderPath }).where(eq(courses.id, id)).run();
}

export function setCourseTitle(id: string, title: string) {
  db.update(courses).set({ title }).where(eq(courses.id, id)).run();
}

export function setCourseDescription(id: string, description: string | null) {
  db.update(courses).set({ description }).where(eq(courses.id, id)).run();
}

export function setCourseSection(id: string, sectionId: string | null) {
  db.update(courses).set({ sectionId }).where(eq(courses.id, id)).run();
}

// Joining a collection clears the course's own sectionId in the same write
// — the collection becomes the sole place section membership lives for it
// (see courses.collectionId's schema comment). Passing null removes it from
// whatever collection it was in, making it standalone again; that does NOT
// restore any previous sectionId, since the whole point is there's only
// ever one section membership to track at a time, not two to reconcile.
export function setCourseCollection(id: string, collectionId: string | null) {
  db.update(courses)
    .set({ collectionId, ...(collectionId ? { sectionId: null } : {}) })
    .where(eq(courses.id, id))
    .run();
}

export function setCourseHidden(id: string, hidden: boolean) {
  db.update(courses).set({ hidden }).where(eq(courses.id, id)).run();
}

export function markCourseComplete(id: string, completed: boolean) {
  db.update(courses)
    .set({ completedAt: completed ? new Date().toISOString() : null })
    .where(eq(courses.id, id))
    .run();
}

export function setCourseDuration(id: string, durationSeconds: number) {
  db.update(courses).set({ durationSeconds }).where(eq(courses.id, id)).run();
}

export function setCourseCoverPath(id: string, coverImagePath: string) {
  db.update(courses).set({ coverImagePath }).where(eq(courses.id, id)).run();
}

// Cascades to the course's nodes/video_meta/subtitle_tracks via their FKs.
// A rescan never removes a course itself (only flags its missing nodes), so
// this is the only way to clear out a stale/incorrectly-scanned course row —
// e.g. one left over from before the fixed-depth classification rule.
export function deleteCourse(id: string) {
  db.delete(courses).where(eq(courses.id, id)).run();
}
