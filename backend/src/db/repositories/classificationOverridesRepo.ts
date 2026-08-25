import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { classificationOverrides } from "../schema.js";

export function getOverride(folderPath: string) {
  return db.select().from(classificationOverrides).where(eq(classificationOverrides.folderPath, folderPath)).get();
}

export function setOverride(folderPath: string, kind: "section" | "course") {
  const existing = getOverride(folderPath);
  if (existing) {
    db.update(classificationOverrides).set({ kind }).where(eq(classificationOverrides.folderPath, folderPath)).run();
    return;
  }
  db.insert(classificationOverrides).values({ folderPath, kind }).run();
}

export function clearOverride(folderPath: string) {
  db.delete(classificationOverrides).where(eq(classificationOverrides.folderPath, folderPath)).run();
}

export function listOverrides() {
  return db.select().from(classificationOverrides).all();
}
