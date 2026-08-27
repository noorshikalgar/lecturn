import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { ExploreEntry, ExploreResult } from "@lecturn/shared";
import { getCourseByFolderPath } from "../db/repositories/coursesRepo.js";

/** Lists immediate subdirectories of a path within a library, for the
 * Library Explorer's folder browser — scoped so the admin can't wander
 * outside the library's own root via a crafted path query param. */
export async function exploreLibrary(libraryRootPath: string, rawPath: string | undefined): Promise<ExploreResult> {
  const target = resolve(rawPath || libraryRootPath);
  const rel = relative(libraryRootPath, target);
  if (rel === ".." || rel.startsWith(`..${"/"}`) || rel.startsWith("../")) {
    throw new RangeError("Path is outside the library root");
  }

  const entries = await readdir(target, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const result: ExploreEntry[] = dirs.map((name) => {
    const fullPath = resolve(target, name);
    const course = getCourseByFolderPath(fullPath);
    return course
      ? { name, path: fullPath, isCourse: true, courseId: course.id }
      : { name, path: fullPath, isCourse: false, courseId: null };
  });

  const parent = target === libraryRootPath ? null : dirname(target);
  return { path: target, parent, entries: result };
}
