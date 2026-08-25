import { sep } from "node:path";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "../client.js";
import { courses } from "../schema.js";

export function getCourseByFolderPath(folderPath: string) {
  return db.select().from(courses).where(eq(courses.folderPath, folderPath)).get();
}

export function getCourseById(id: number) {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

export function listCourses() {
  return db.select().from(courses).orderBy(courses.title).all();
}

export function listCoursesBySection(sectionId: number) {
  return db.select().from(courses).where(eq(courses.sectionId, sectionId)).orderBy(courses.title).all();
}

export function listRecentCourses(limit = 20) {
  return db.select().from(courses).orderBy(desc(courses.createdAt)).limit(limit).all();
}

export function listUnassignedCourses() {
  return db.select().from(courses).where(isNull(courses.sectionId)).orderBy(desc(courses.createdAt)).all();
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

export function createCourse(input: {
  folderPath: string;
  sectionId: number | null;
  title: string;
  description: string | null;
  topLevelFolder: string | null;
}) {
  return db.insert(courses).values(input).returning().get();
}

export function setCourseTitle(id: number, title: string) {
  db.update(courses).set({ title }).where(eq(courses.id, id)).run();
}

export function setCourseDescription(id: number, description: string) {
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
