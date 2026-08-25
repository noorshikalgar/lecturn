import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { libraries } from "../schema.js";

export function listLibraries() {
  return db.select().from(libraries).orderBy(libraries.id).all();
}

export function getLibraryById(id: number) {
  return db.select().from(libraries).where(eq(libraries.id, id)).get();
}

export function createLibrary(rootPath: string) {
  return db.insert(libraries).values({ rootPath }).returning().get();
}

export function touchLibraryScanned(id: number) {
  db.update(libraries).set({ lastScannedAt: new Date().toISOString() }).where(eq(libraries.id, id)).run();
}

export function deleteLibrary(id: number) {
  db.delete(libraries).where(eq(libraries.id, id)).run();
}
