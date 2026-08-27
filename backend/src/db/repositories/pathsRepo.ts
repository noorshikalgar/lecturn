import { and, asc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { courses, pathCourses, paths } from "../schema.js";
import { withVideoCounts } from "./coursesRepo.js";

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

// videoCount (lesson count) is attached the same way every other
// card-facing course listing does it — the Paths index page shows a lesson
// count per course without loading each one's full tree.
export function listPathCourses(pathId: number, userId: number) {
  const rows = db
    .select({ course: courses, orderIndex: pathCourses.orderIndex })
    .from(pathCourses)
    .innerJoin(courses, eq(courses.id, pathCourses.courseId))
    .where(eq(pathCourses.pathId, pathId))
    .orderBy(asc(pathCourses.orderIndex))
    .all();
  const enrichedCourses = withVideoCounts(
    rows.map((r) => r.course),
    userId,
  );
  return rows.map((r, i) => ({ course: enrichedCourses[i], orderIndex: r.orderIndex }));
}

export function isCourseInPath(pathId: number, courseId: number): boolean {
  return db
    .select({ courseId: pathCourses.courseId })
    .from(pathCourses)
    .where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId)))
    .get() !== undefined;
}

export function addCourseToPath(pathId: number, courseId: number) {
  const { maxOrder } = db
    .select({ maxOrder: sql<number | null>`max(${pathCourses.orderIndex})` })
    .from(pathCourses)
    .where(eq(pathCourses.pathId, pathId))
    .get()!;
  const nextOrder = maxOrder === null ? 0 : maxOrder + 1;
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
