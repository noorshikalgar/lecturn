import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { sections } from "../schema.js";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

export function getSectionByFolderPath(libraryId: number, folderPath: string) {
  return db
    .select()
    .from(sections)
    .where(and(eq(sections.libraryId, libraryId), eq(sections.folderPath, folderPath)))
    .get();
}

export function getOrCreateSection(libraryId: number, folderPath: string, title: string, orderIndex: number) {
  const existing = getSectionByFolderPath(libraryId, folderPath);
  if (existing) return existing;
  return db
    .insert(sections)
    .values({ libraryId, folderPath, title, slug: slugify(title), orderIndex })
    .returning()
    .get();
}

export function listSections(libraryId: number) {
  return db.select().from(sections).where(eq(sections.libraryId, libraryId)).orderBy(sections.orderIndex).all();
}

// Courses under a deleted section aren't cascade-deleted (their sectionId FK
// is ON DELETE SET NULL) — they just become uncategorized, which is what we
// want when a reclassify converts this folder from a section into a course.
export function deleteSectionByFolderPath(libraryId: number, folderPath: string) {
  db.delete(sections).where(and(eq(sections.libraryId, libraryId), eq(sections.folderPath, folderPath))).run();
}
