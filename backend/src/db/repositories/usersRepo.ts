import { eq } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { notes, progress, sessions, users } from "../schema.js";

export type UserRole = "admin" | "user";

export function getUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listUsers() {
  return db.select().from(users).orderBy(users.id).all();
}

export function countUsers(): number {
  return db.select().from(users).all().length;
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}) {
  return db.insert(users).values(input).returning().get();
}

export function updateUserPassword(id: number, passwordHash: string, passwordSalt: string) {
  db.update(users).set({ passwordHash, passwordSalt }).where(eq(users.id, id)).run();
}

export function updateUser(id: number, patch: { role?: UserRole }) {
  db.update(users).set(patch).where(eq(users.id, id)).run();
}

export const deleteUser = sqlite.transaction((id: number) => {
  db.delete(sessions).where(eq(sessions.userId, id)).run();
  db.delete(progress).where(eq(progress.userId, id)).run();
  db.delete(notes).where(eq(notes.userId, id)).run();
  db.delete(users).where(eq(users.id, id)).run();
});
