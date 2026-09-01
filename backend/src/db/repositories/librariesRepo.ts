import { eq } from "drizzle-orm";
import type { ScanSummary } from "@lecturn/shared";
import { db } from "../client.js";
import { libraries } from "../schema.js";

export function listLibraries() {
  return db.select().from(libraries).orderBy(libraries.id).all();
}

export function getLibraryById(id: number) {
  return db.select().from(libraries).where(eq(libraries.id, id)).get();
}

export function getLibraryByRootPath(rootPath: string) {
  return db.select().from(libraries).where(eq(libraries.rootPath, rootPath)).get();
}

export function createLibrary(rootPath: string) {
  return db.insert(libraries).values({ rootPath }).returning().get();
}

export function touchLibraryScanned(id: number) {
  db.update(libraries).set({ lastScannedAt: new Date().toISOString() }).where(eq(libraries.id, id)).run();
}

export function markScanRunning(id: number) {
  db.update(libraries)
    .set({ scanStatus: "running", scanStartedAt: new Date().toISOString(), scanError: null })
    .where(eq(libraries.id, id))
    .run();
}

export function markScanCompleted(id: number, summary: ScanSummary) {
  db.update(libraries)
    .set({ scanStatus: "completed", lastScanSummary: JSON.stringify(summary) })
    .where(eq(libraries.id, id))
    .run();
}

export function markScanFailed(id: number, message: string) {
  db.update(libraries).set({ scanStatus: "failed", scanError: message }).where(eq(libraries.id, id)).run();
}

export function deleteLibrary(id: number) {
  db.delete(libraries).where(eq(libraries.id, id)).run();
}
