import { and, asc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { nodes, notes } from "../schema.js";

export function listNotesForVideo(userId: number, videoNodeId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.videoNodeId, videoNodeId)))
    .orderBy(asc(notes.timestampSeconds), asc(notes.createdAt))
    .all();
}

// Flat list, one row per note, joined with its video node's title/order so
// the client can group by chapter without a second round-trip — it already
// has the full course tree loaded to walk for hierarchy.
export function listNotesForCourse(userId: number, courseId: number) {
  return db
    .select({
      id: notes.id,
      userId: notes.userId,
      videoNodeId: notes.videoNodeId,
      timestampSeconds: notes.timestampSeconds,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      videoTitle: nodes.title,
      videoParentId: nodes.parentId,
      videoOrderIndex: nodes.orderIndex,
    })
    .from(notes)
    .innerJoin(nodes, eq(nodes.id, notes.videoNodeId))
    .where(and(eq(notes.userId, userId), eq(nodes.courseId, courseId)))
    .orderBy(asc(nodes.orderIndex), asc(notes.timestampSeconds), asc(notes.createdAt))
    .all();
}

export function getNoteById(id: number) {
  return db.select().from(notes).where(eq(notes.id, id)).get();
}

export function createNote(userId: number, videoNodeId: number, timestampSeconds: number | null, body: string) {
  return db.insert(notes).values({ userId, videoNodeId, timestampSeconds, body }).returning().get();
}

export function updateNote(id: number, patch: { timestampSeconds?: number | null; body?: string }) {
  db.update(notes)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id))
    .run();
}

export function deleteNote(id: number) {
  db.delete(notes).where(eq(notes.id, id)).run();
}
