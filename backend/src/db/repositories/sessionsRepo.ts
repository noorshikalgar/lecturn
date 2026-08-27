import { and, isNull, lt, or, eq } from "drizzle-orm";
import { db } from "../client.js";
import { sessions } from "../schema.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Independent of the absolute 30-day TTL above — a session that's been
// authenticated but sat completely idle for two weeks is expired even
// though its absolute lifetime hasn't run out yet.
const IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export function createSession(token: string, userId: number) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  return expiresAt;
}

export function getSession(token: string) {
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get();
  if (!row) return undefined;
  const lastActivity = new Date(row.lastSeenAt ?? row.createdAt).getTime();
  const expired = new Date(row.expiresAt).getTime() < Date.now() || Date.now() - lastActivity > IDLE_TIMEOUT_MS;
  if (expired) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
    return undefined;
  }
  return row;
}

// Called on every authenticated request (see middleware/auth.ts) so the
// idle-timeout check above has an accurate clock to measure against.
export function touchSession(token: string) {
  db.update(sessions).set({ lastSeenAt: new Date().toISOString() }).where(eq(sessions.token, token)).run();
}

export function deleteSession(token: string) {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

export function deleteSessionsForUser(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

// Expired rows were previously only ever pruned lazily, one at a time, when
// that exact token happened to be presented again — meaning a session
// nobody ever came back to just sat in the table forever. Run periodically
// from server.ts instead.
export function deleteExpiredSessions() {
  const nowIso = new Date().toISOString();
  const idleCutoff = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString();
  const result = db
    .delete(sessions)
    .where(
      or(
        lt(sessions.expiresAt, nowIso),
        and(isNull(sessions.lastSeenAt), lt(sessions.createdAt, idleCutoff)),
        lt(sessions.lastSeenAt, idleCutoff),
      ),
    )
    .run();
  return result.changes;
}
