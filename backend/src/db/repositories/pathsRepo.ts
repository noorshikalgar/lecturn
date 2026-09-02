import { and, asc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { courses, pathCourses, paths } from "../schema.js";
import { withVideoCounts } from "./coursesRepo.js";

export function listPaths() {
  // id as a tiebreaker: every existing path defaults to orderIndex 0 on the
  // migration that added the column, so without this they'd all sort
  // equal (DB-dependent order) until an admin actually reorders them.
  return db.select().from(paths).orderBy(asc(paths.orderIndex), asc(paths.id)).all();
}

export function getPathById(id: string) {
  return db.select().from(paths).where(eq(paths.id, id)).get();
}

export function createPath(title: string, description: string | null) {
  const { maxOrder } = db.select({ maxOrder: sql<number | null>`max(${paths.orderIndex})` }).from(paths).get()!;
  const orderIndex = maxOrder === null ? 0 : maxOrder + 1;
  return db.insert(paths).values({ title, description, orderIndex }).returning().get();
}

export const reorderPaths = sqlite.transaction((orderedPathIds: string[]) => {
  orderedPathIds.forEach((id, index) => {
    db.update(paths).set({ orderIndex: index }).where(eq(paths.id, id)).run();
  });
});

export function updatePath(id: string, patch: { title?: string; description?: string | null }) {
  db.update(paths).set(patch).where(eq(paths.id, id)).run();
}

export function deletePath(id: string) {
  db.delete(paths).where(eq(paths.id, id)).run();
}

// videoCount (lesson count) is attached the same way every other
// card-facing course listing does it — the Paths index page shows a lesson
// count per course without loading each one's full tree.
export function listPathCourses(pathId: string, userId: string) {
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

export function isCourseInPath(pathId: string, courseId: string): boolean {
  return db
    .select({ courseId: pathCourses.courseId })
    .from(pathCourses)
    .where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId)))
    .get() !== undefined;
}

export function addCourseToPath(pathId: string, courseId: string) {
  const { maxOrder } = db
    .select({ maxOrder: sql<number | null>`max(${pathCourses.orderIndex})` })
    .from(pathCourses)
    .where(eq(pathCourses.pathId, pathId))
    .get()!;
  const nextOrder = maxOrder === null ? 0 : maxOrder + 1;
  db.insert(pathCourses).values({ pathId, courseId, orderIndex: nextOrder }).run();
}

export function removeCourseFromPath(pathId: string, courseId: string) {
  db.delete(pathCourses).where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId))).run();
}

export const reorderPathCourses = sqlite.transaction((pathId: string, orderedCourseIds: string[]) => {
  orderedCourseIds.forEach((courseId, index) => {
    db.update(pathCourses)
      .set({ orderIndex: index })
      .where(and(eq(pathCourses.pathId, pathId), eq(pathCourses.courseId, courseId)))
      .run();
  });
});
