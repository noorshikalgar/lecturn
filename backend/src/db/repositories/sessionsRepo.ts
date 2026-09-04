import { and, isNull, lt, or, eq, desc } from "drizzle-orm";
import { db } from "../client.js";
import { sessions } from "../schema.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Independent of the absolute 30-day TTL above — a session that's been
// authenticated but sat completely idle for two weeks is expired even
// though its absolute lifetime hasn't run out yet.
const IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export function createSession(token: string, userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  return expiresAt;
}

export function getSession(token: string) {
  const row = db.select().from(sessions).where(and(eq(sessions.token, token), isNull(sessions.endedAt))).get();
  if (!row) return undefined;
  const lastActivity = new Date(row.lastSeenAt ?? row.createdAt).getTime();
  const expired = new Date(row.expiresAt).getTime() < Date.now() || Date.now() - lastActivity > IDLE_TIMEOUT_MS;
  if (expired) {
    endSession(token);
    return undefined;
  }
  return row;
}

// Called on every authenticated request (see middleware/auth.ts) so the
// idle-timeout check above has an accurate clock to measure against.
export function touchSession(token: string) {
  db.update(sessions).set({ lastSeenAt: new Date().toISOString() }).where(eq(sessions.token, token)).run();
}

// Soft-ends a session rather than deleting the row — a durable login/logout
// history (see users' activity view) needs the row to survive; only
// `endedAt` (and whatever caused it, tracked at the call site) changes.
// Idempotent: ending an already-ended session is a no-op, not an error.
export function endSession(token: string) {
  db.update(sessions)
    .set({ endedAt: new Date().toISOString() })
    .where(and(eq(sessions.token, token), isNull(sessions.endedAt)))
    .run();
}

export function endSessionsForUser(userId: string) {
  db.update(sessions)
    .set({ endedAt: new Date().toISOString() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.endedAt)))
    .run();
}

/** Newest-first login/logout history for a user — the "was logged in for 2
 * days" admin view. Duration for an ended session is endedAt - createdAt;
 * for a still-live one (endedAt null), it's ongoing. */
export function listSessionHistoryForUser(userId: string) {
  return db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.createdAt)).all();
}

/** Each user's single most recent session (by createdAt), for the admin
 * Users table's "last login"/"last active" columns — one query for every
 * user at once rather than N+1, then reduced to "first seen per user" in
 * JS since SQLite has no simple DISTINCT ON. Fine at the scale a
 * self-hosted app's session table actually reaches. */
export function getLatestSessionPerUser(): Map<string, { createdAt: string; lastSeenAt: string | null; endedAt: string | null }> {
  const rows = db
    .select({ userId: sessions.userId, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, endedAt: sessions.endedAt })
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .all();
  const byUser = new Map<string, { createdAt: string; lastSeenAt: string | null; endedAt: string | null }>();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, row);
  }
  return byUser;
}

// Expired/idle sessions were previously pruned by deleting the row outright
// — that permanently destroyed the exact login/logout history this table
// now exists to keep. This soft-ends them instead (same as an explicit
// logout, just system-triggered), so a session nobody ever came back to
// stops being usable without erasing that it ever happened. Run
// periodically from server.ts.
export function endExpiredSessions() {
  const nowIso = new Date().toISOString();
  const idleCutoff = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString();
  const result = db
    .update(sessions)
    .set({ endedAt: nowIso })
    .where(
      and(
        isNull(sessions.endedAt),
        or(
          lt(sessions.expiresAt, nowIso),
          and(isNull(sessions.lastSeenAt), lt(sessions.createdAt, idleCutoff)),
          lt(sessions.lastSeenAt, idleCutoff),
        ),
      ),
    )
    .run();
  return result.changes;
}
