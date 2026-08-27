import { join, relative, resolve } from "node:path";
import { getCourseById } from "../db/repositories/coursesRepo.js";

/** Absolute on-disk path for a node, joining its course's library folder with
 * the node's path relative to that course root.
 *
 * relativePath only ever comes from the scanner today (no route lets a
 * client set it directly), so this containment check isn't closing a
 * reachable exploit right now — it's here so that stays true structurally,
 * not just by convention, the moment some future endpoint accepts a path
 * from outside. */
export function resolveNodeAbsolutePath(courseId: number, relativePath: string): string | undefined {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  const root = resolve(course.folderPath);
  const target = resolve(join(root, relativePath));
  const rel = relative(root, target);
  if (rel.startsWith("..") || rel === "") return undefined;
  return target;
}
