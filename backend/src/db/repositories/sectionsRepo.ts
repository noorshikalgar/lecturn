import { eq } from "drizzle-orm";
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

export function listSections() {
  return db.select().from(sections).orderBy(sections.orderIndex).all();
}

export function getSectionById(id: number) {
  return db.select().from(sections).where(eq(sections.id, id)).get();
}

export function createSection(title: string) {
  const maxOrder = db.select().from(sections).all().reduce((max, s) => Math.max(max, s.orderIndex), -1);
  return db
    .insert(sections)
    .values({ title, slug: slugify(title), orderIndex: maxOrder + 1 })
    .returning()
    .get();
}

// Courses in this section aren't cascade-deleted (their sectionId FK is ON
// DELETE SET NULL) — they just become unassigned again.
export function deleteSection(id: number) {
  db.delete(sections).where(eq(sections.id, id)).run();
}

export function setSectionHidden(id: number, hidden: boolean) {
  db.update(sections).set({ hidden }).where(eq(sections.id, id)).run();
}

export function listHiddenSectionIds(): Set<number> {
  return new Set(
    db
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.hidden, true))
      .all()
      .map((r) => r.id),
  );
}
