import { and, asc, eq } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { courses, pathCourses, paths } from "../schema.js";

export function listPaths() {
  return db.select().from(paths).orderBy(asc(paths.id)).all();
}

export function getPathById(id: number) {
  return db.select().from(paths).where(eq(paths.id, id)).get();
}

export function createPath(title: string, description: string | null) {
  return db.insert(paths).values({ title, description }).returning().get();
}

export function updatePath(id: number, patch: { title?: string; description?: string | null }) {
  db.update(paths).set(patch).where(eq(paths.id, id)).run();
}

export function deletePath(id: number) {
  db.delete(paths).where(eq(paths.id, id)).run();
}

export function listPathCourses(pathId: number) {
  return db
    .select({ course: courses, orderIndex: pathCourses.orderIndex })
    .from(pathCourses)
    .innerJoin(courses, eq(courses.id, pathCourses.courseId))
    .where(eq(pathCourses.pathId, pathId))
    .orderBy(asc(pathCourses.orderIndex))
    .all();
}

export function addCourseToPath(pathId: number, courseId: number) {
  const existing = db
    .select({ maxOrder: pathCourses.orderIndex })
    .from(pathCourses)
    .where(eq(pathCourses.pathId, pathId))
    .orderBy(asc(pathCourses.orderIndex))
    .all();
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.maxOrder)) + 1 : 0;
  db.insert(pathCourses).values({ pathId, courseId, orderIndex: nextOrder }).run();
}

export function removeCourseFromPath(pathId: number, courseId: number) {
  db.delete(pathCourses).where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId))).run();
}

export const reorderPathCourses = sqlite.transaction((pathId: number, orderedCourseIds: number[]) => {
  orderedCourseIds.forEach((courseId, index) => {
    db.update(pathCourses)
      .set({ orderIndex: index })
      .where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId)))
      .run();
  });
});
