import { existsSync } from "node:fs";
import { sep } from "node:path";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client.js";
import { courses, nodes } from "../schema.js";

// Card-facing list endpoints show a lesson count alongside duration — cheap
// to compute in one grouped query rather than a per-course subquery.
function withVideoCounts<T extends { id: number }>(rows: T[]): (T & { videoCount: number })[] {
  if (rows.length === 0) return rows as (T & { videoCount: number })[];
  const counts = db
    .select({ courseId: nodes.courseId, count: sql<number>`count(*)` })
    .from(nodes)
    .where(and(eq(nodes.type, "video"), inArray(nodes.courseId, rows.map((r) => r.id))))
    .groupBy(nodes.courseId)
    .all();
  const byCourse = new Map(counts.map((c) => [c.courseId, c.count]));
  return rows.map((r) => ({ ...r, videoCount: byCourse.get(r.id) ?? 0 }));
}

export function getCourseByFolderPath(folderPath: string) {
  return db.select().from(courses).where(eq(courses.folderPath, folderPath)).get();
}

export function getCourseById(id: number) {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

export function listCourses() {
  return withVideoCounts(db.select().from(courses).orderBy(courses.title).all());
}

export function listCoursesBySection(sectionId: number) {
  return withVideoCounts(db.select().from(courses).where(eq(courses.sectionId, sectionId)).orderBy(courses.title).all());
}

export function listRecentCourses(limit = 20) {
  return withVideoCounts(db.select().from(courses).orderBy(desc(courses.createdAt)).limit(limit).all());
}

// SQLite's LIKE is case-insensitive for ASCII by default — no need for a
// LOWER() wrap. % and _ escaped (with an explicit ESCAPE clause, since
// SQLite doesn't apply one by default) so a literal "%" in a search term
// isn't treated as a wildcard.
export function searchCourses(query: string, limit = 20) {
  const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
  return withVideoCounts(
    db
      .select()
      .from(courses)
      .where(sql`${courses.title} LIKE ${`%${escaped}%`} ESCAPE '\\'`)
      .orderBy(courses.title)
      .limit(limit)
      .all(),
  );
}

export function listUnassignedCourses() {
  return withVideoCounts(db.select().from(courses).where(isNull(courses.sectionId)).orderBy(desc(courses.createdAt)).all());
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
  sectionId: number | null;
  title: string;
  description: string | null;
  topLevelFolder: string | null;
}) {
  return db.insert(courses).values(input).returning().get();
}

export function setCourseFolderPath(id: number, folderPath: string) {
  db.update(courses).set({ folderPath }).where(eq(courses.id, id)).run();
}

export function setCourseTitle(id: number, title: string) {
  db.update(courses).set({ title }).where(eq(courses.id, id)).run();
}

export function setCourseDescription(id: number, description: string | null) {
  db.update(courses).set({ description }).where(eq(courses.id, id)).run();
}

export function setCourseSection(id: number, sectionId: number | null) {
  db.update(courses).set({ sectionId }).where(eq(courses.id, id)).run();
}

export function setCourseHidden(id: number, hidden: boolean) {
  db.update(courses).set({ hidden }).where(eq(courses.id, id)).run();
}

export function markCourseComplete(id: number, completed: boolean) {
  db.update(courses)
    .set({ completedAt: completed ? new Date().toISOString() : null })
    .where(eq(courses.id, id))
    .run();
}

export function setCourseDuration(id: number, durationSeconds: number) {
  db.update(courses).set({ durationSeconds }).where(eq(courses.id, id)).run();
}

export function setCourseCoverPath(id: number, coverImagePath: string) {
  db.update(courses).set({ coverImagePath }).where(eq(courses.id, id)).run();
}

// Cascades to the course's nodes/video_meta/subtitle_tracks via their FKs.
// A rescan never removes a course itself (only flags its missing nodes), so
// this is the only way to clear out a stale/incorrectly-scanned course row —
// e.g. one left over from before the fixed-depth classification rule.
export function deleteCourse(id: number) {
  db.delete(courses).where(eq(courses.id, id)).run();
}
