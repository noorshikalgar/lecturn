import { desc, eq } from "drizzle-orm";
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

export function createCourse(input: {
  folderPath: string;
  sectionId: number | null;
  title: string;
  description: string | null;
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

// Cascades to the course's nodes/video_meta/subtitle_tracks via their FKs —
// used when a reclassify converts this folder from a course into a section.
export function deleteCourseByFolderPath(folderPath: string) {
  db.delete(courses).where(eq(courses.folderPath, folderPath)).run();
}
