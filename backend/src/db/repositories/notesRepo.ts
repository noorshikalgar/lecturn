import { and, asc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { notes } from "../schema.js";

export function listNotesForVideo(userId: number, videoNodeId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.videoNodeId, videoNodeId)))
    .orderBy(asc(notes.timestampSeconds), asc(notes.createdAt))
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
