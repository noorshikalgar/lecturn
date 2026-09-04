import { existsSync } from "node:fs";
import { sep } from "node:path";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client.js";
import { collections, courses } from "../schema.js";
import { setCourseCollection } from "./coursesRepo.js";

export function getCollectionById(id: string) {
  return db.select().from(collections).where(eq(collections.id, id)).get();
}

export function getCollectionByFolderPath(folderPath: string) {
  return db.select().from(collections).where(eq(collections.folderPath, folderPath)).get();
}

export function listCollections() {
  return db.select().from(collections).orderBy(collections.title).all();
}

export function listCollectionsBySection(sectionId: string) {
  return db.select().from(collections).where(eq(collections.sectionId, sectionId)).orderBy(collections.title).all();
}

export function listUnassignedCollections() {
  return db.select().from(collections).where(isNull(collections.sectionId)).orderBy(desc(collections.createdAt)).all();
}

export function listRecentCollections(limit = 20) {
  return db.select().from(collections).orderBy(desc(collections.createdAt)).limit(limit).all();
}

export function searchCollections(query: string, limit = 20) {
  const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select()
    .from(collections)
    .where(sql`${collections.title} LIKE ${`%${escaped}%`} ESCAPE '\\'`)
    .orderBy(collections.title)
    .limit(limit)
    .all();
}

// Courses already scanned/marked whose folder sits inside this collection's
// folder — used at collection-creation time so marking the parent as a
// collection retroactively groups any courses already marked under it,
// regardless of which order the admin did the two steps in.
export function listCoursesUnderFolder(folderPath: string) {
  const prefix = folderPath.endsWith(sep) ? folderPath : folderPath + sep;
  return db
    .select()
    .from(courses)
    .all()
    .filter((c) => c.folderPath.startsWith(prefix));
}

export function createCollection(input: { folderPath: string; title: string; topLevelFolder: string | null }) {
  const collection = db.insert(collections).values(input).returning().get();
  for (const course of listCoursesUnderFolder(input.folderPath)) {
    if (!course.collectionId) setCourseCollection(course.id, collection.id);
  }
  return collection;
}

export function setCollectionTitle(id: string, title: string) {
  db.update(collections).set({ title }).where(eq(collections.id, id)).run();
}

export function setCollectionSection(id: string, sectionId: string | null) {
  db.update(collections).set({ sectionId }).where(eq(collections.id, id)).run();
}

export function setCollectionHidden(id: string, hidden: boolean) {
  db.update(collections).set({ hidden }).where(eq(collections.id, id)).run();
}

export function setCollectionFolderPath(id: string, folderPath: string) {
  db.update(collections).set({ folderPath }).where(eq(collections.id, id)).run();
}

// Child courses survive (their collectionId is cleared via the FK's ON
// DELETE SET NULL) — unmarking a collection reverts its parts to standalone
// courses, it never touches their progress/notes/certs.
export function deleteCollection(id: string) {
  db.delete(collections).where(eq(collections.id, id)).run();
}

export function listCollectionsUnderPath(rootPath: string) {
  const prefix = rootPath.endsWith(sep) ? rootPath : rootPath + sep;
  return db
    .select()
    .from(collections)
    .all()
    .filter((c) => c.folderPath.startsWith(prefix));
}

export function listOrphanedCollectionsForLibrary(rootPath: string) {
  return listCollectionsUnderPath(rootPath).filter((c) => !existsSync(c.folderPath));
}
