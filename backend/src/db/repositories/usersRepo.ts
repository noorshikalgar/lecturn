import { count, eq, sql } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { notes, progress, sessions, users } from "../schema.js";

export type UserRole = "admin" | "user";

// Case-insensitive on purpose — usernames aren't meant to be case-sensitive
// (a login form that rejects "Bob" because the account is "bob" is just a
// bug users hit), and comparing via LOWER() here means it works for every
// existing row regardless of how it was originally typed in, no migration
// needed. Doubles as the uniqueness check in createUserRecord, so two
// accounts differing only by case can't be created either.
export function getUserByUsername(username: string) {
  return db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .get();
}

export function getUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listUsers() {
  return db.select().from(users).orderBy(users.id).all();
}

export function countUsers(): number {
  return db.select({ count: count() }).from(users).get()!.count;
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}) {
  return db.insert(users).values(input).returning().get();
}

export function updateUserPassword(id: string, passwordHash: string, passwordSalt: string) {
  db.update(users).set({ passwordHash, passwordSalt }).where(eq(users.id, id)).run();
}

export function updateUser(id: string, patch: { role?: UserRole }) {
  db.update(users).set(patch).where(eq(users.id, id)).run();
}

export const deleteUser = sqlite.transaction((id: string) => {
  db.delete(sessions).where(eq(sessions.userId, id)).run();
  db.delete(progress).where(eq(progress.userId, id)).run();
  db.delete(notes).where(eq(notes.userId, id)).run();
  db.delete(users).where(eq(users.id, id)).run();
});
