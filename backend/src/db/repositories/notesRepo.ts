import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { courses, nodes, notes } from "../schema.js";

export function listNotesForVideo(userId: string, videoNodeId: string) {
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
export function listNotesForCourse(userId: string, courseId: string) {
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

// Notes are private to their author, unlike course/node search — so this
// is scoped to userId rather than filtered by visibility after the fact.
// Course sectionId/hidden still come back so the caller can drop a note
// whose course access was revoked since the note was written, rather than
// deep-linking into content the user can no longer actually open.
export function searchNotesForUser(userId: string, query: string, limit = 20) {
  const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select({
      noteId: notes.id,
      body: notes.body,
      timestampSeconds: notes.timestampSeconds,
      videoNodeId: notes.videoNodeId,
      videoTitle: nodes.title,
      courseId: nodes.courseId,
      courseTitle: courses.title,
      courseSectionId: courses.sectionId,
      courseHidden: courses.hidden,
    })
    .from(notes)
    .innerJoin(nodes, eq(nodes.id, notes.videoNodeId))
    .innerJoin(courses, eq(courses.id, nodes.courseId))
    .where(and(eq(notes.userId, userId), sql`${notes.body} LIKE ${`%${escaped}%`} ESCAPE '\\'`))
    .orderBy(sql`${notes.updatedAt} desc`)
    .limit(limit)
    .all();
}

export function getNoteById(id: string) {
  return db.select().from(notes).where(eq(notes.id, id)).get();
}

export function createNote(userId: string, videoNodeId: string, timestampSeconds: number | null, body: string) {
  return db.insert(notes).values({ userId, videoNodeId, timestampSeconds, body }).returning().get();
}

export function updateNote(id: string, patch: { timestampSeconds?: number | null; body?: string }) {
  db.update(notes)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id))
    .run();
}

export function deleteNote(id: string) {
  db.delete(notes).where(eq(notes.id, id)).run();
}
