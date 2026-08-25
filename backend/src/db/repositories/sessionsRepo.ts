import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { sessions } from "../schema.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createSession(token: string, userId: number) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  return expiresAt;
}

export function getSession(token: string) {
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get();
  if (!row) return undefined;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
    return undefined;
  }
  return row;
}

export function deleteSession(token: string) {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

export function deleteSessionsForUser(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}
