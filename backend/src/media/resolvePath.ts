import { join } from "node:path";
import { getCourseById } from "../db/repositories/coursesRepo.js";

/** Absolute on-disk path for a node, joining its course's library folder with
 * the node's path relative to that course root. */
export function resolveNodeAbsolutePath(courseId: number, relativePath: string): string | undefined {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  return join(course.folderPath, relativePath);
}
