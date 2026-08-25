import { and, desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { courses, nodes, progress } from "../schema.js";

export function getProgress(userId: number, videoNodeId: number) {
  return db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.videoNodeId, videoNodeId)))
    .get();
}

export function upsertProgress(userId: number, videoNodeId: number, positionSeconds: number, completed?: boolean) {
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

export function listProgressForCourse(userId: number, courseId: number) {
  return db
    .select({ progress })
    .from(progress)
    .innerJoin(nodes, eq(nodes.id, progress.videoNodeId))
    .where(and(eq(progress.userId, userId), eq(nodes.courseId, courseId)))
    .all()
    .map((r) => r.progress);
}

export function listContinueWatching(userId: number, limit = 20) {
  return db
    .select({ progress, nodeTitle: nodes.title, course: courses })
    .from(progress)
    .innerJoin(nodes, eq(nodes.id, progress.videoNodeId))
    .innerJoin(courses, eq(courses.id, nodes.courseId))
    .where(and(eq(progress.userId, userId), eq(progress.completed, false)))
    .orderBy(desc(progress.lastWatchedAt))
    .limit(limit)
    .all();
}
