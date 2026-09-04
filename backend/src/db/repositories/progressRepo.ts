import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { collections, courses, nodes, progress } from "../schema.js";

export function getProgress(userId: string, videoNodeId: string) {
  return db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.videoNodeId, videoNodeId)))
    .get();
}

export function upsertProgress(userId: string, videoNodeId: string, positionSeconds: number, completed?: boolean) {
  const existing = getProgress(userId, videoNodeId);
  const now = new Date().toISOString();
  if (existing) {
    db.update(progress)
      .set({ positionSeconds, lastWatchedAt: now, ...(completed !== undefined ? { completed } : {}) })
      .where(and(eq(progress.userId, userId), eq(progress.videoNodeId, videoNodeId)))
      .run();
    return;
  }
  db.insert(progress)
    .values({ userId, videoNodeId, positionSeconds, completed: completed ?? false, lastWatchedAt: now })
    .run();
}

// Sum of positionSeconds across every video a user has any progress on —
// the closest thing to "total watch time" this app tracks (there's no
// separate "seconds actually played" counter; position is how far into a
// video they've gotten, which is what the player itself already treats as
// the source of truth for resuming).
export function getTotalWatchSeconds(userId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${progress.positionSeconds}), 0)` })
    .from(progress)
    .where(eq(progress.userId, userId))
    .get();
  return row?.total ?? 0;
}

export function listProgressForCourse(userId: string, courseId: string) {
  return db
    .select({ progress })
    .from(progress)
    .innerJoin(nodes, eq(nodes.id, progress.videoNodeId))
    .where(and(eq(progress.userId, userId), eq(nodes.courseId, courseId)))
    .all()
    .map((r) => r.progress);
}

// One row per *course*, not per video — a course with several
// half-watched lessons must surface once (its most recently watched one),
// not once per unfinished lesson. Dedup happens here in JS rather than a
// SQL LIMIT, since a plain LIMIT before dedup could drop other courses
// entirely if one course happened to hog the first N rows.
export function listContinueWatching(userId: string, limit = 20) {
  const rows = db
    .select({ progress, nodeTitle: nodes.title, course: courses, collectionTitle: collections.title })
    .from(progress)
    .innerJoin(nodes, eq(nodes.id, progress.videoNodeId))
    .innerJoin(courses, eq(courses.id, nodes.courseId))
    .leftJoin(collections, eq(collections.id, courses.collectionId))
    .where(and(eq(progress.userId, userId), eq(progress.completed, false)))
    .orderBy(desc(progress.lastWatchedAt))
    .all();

  const seenCourseIds = new Set<string>();
  const deduped: typeof rows = [];
  for (const row of rows) {
    if (seenCourseIds.has(row.course.id)) continue;
    seenCourseIds.add(row.course.id);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }
  return deduped;
}
