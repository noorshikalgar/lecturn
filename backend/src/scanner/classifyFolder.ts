import { join } from "node:path";
import { readDirContents } from "./fsWalk.js";

const MAX_PROBE_DEPTH = 8;

/** Does this folder's subtree contain at least one video, anywhere? Depth-capped
 * so a pathological symlink loop or absurdly deep tree can't hang a scan. */
export async function subtreeHasVideo(dirPath: string, depth = 0): Promise<boolean> {
  if (depth > MAX_PROBE_DEPTH) return false;
  const { videoFiles, subdirs } = await readDirContents(dirPath);
  if (videoFiles.length > 0) return true;
  for (const sub of subdirs) {
    if (await subtreeHasVideo(join(dirPath, sub), depth + 1)) return true;
  }
  return false;
}

// "Part 1", "Volume 2", "Season 3" name a genuinely separate installment —
// each becomes its own course, never merged with its siblings.
const SEPARATE_INSTALLMENT_RE = /^\s*(part|volume|season)\s*\d+/i;

// "Chapter 1", "Module 2", "Lesson 3", "Week 4", "Unit 5", or plain leading
// numbering ("01 - Setup") name internal structure *within* one course.
const INTERNAL_STRUCTURE_RE = /^\s*(chapter|module|lesson|week|unit)\b/i;
const LEADING_NUMBER_RE = /^\s*\d{1,3}\s*[.\-_):]/;

export function looksLikeSeparateInstallment(name: string): boolean {
  return SEPARATE_INSTALLMENT_RE.test(name);
}

export function looksLikeInternalStructure(name: string): boolean {
  return INTERNAL_STRUCTURE_RE.test(name) || LEADING_NUMBER_RE.test(name);
}

export type FolderKind = "section" | "course" | "empty";

/** Section-vs-course heuristic for a top-level (or any) folder:
 * - Videos directly inside -> course.
 * - No video-bearing subtree at all -> empty (skipped, e.g. an ebooks folder).
 * - Exactly one video-bearing child -> course (that child is internal structure).
 * - Multiple video-bearing children, any named like a separate installment
 *   (Part/Volume/Season) -> section, so each becomes its own course — a
 *   "Part 1"/"Part 2" pair is two courses, never one course with two parts.
 * - Multiple video-bearing children, all named like internal structure
 *   (Chapter/Module/Lesson/Week/Unit, or plain numbering) -> course (they're
 *   this course's own chapters).
 * - Multiple video-bearing children with distinct, unstructured names -> section
 *   (a category folder full of separate courses).
 */
export async function classifyFolder(dirPath: string): Promise<FolderKind> {
  const { videoFiles, subdirs } = await readDirContents(dirPath);
  if (videoFiles.length > 0) return "course";
  if (subdirs.length === 0) return "empty";

  const videoBearing: string[] = [];
  for (const sub of subdirs) {
    if (await subtreeHasVideo(join(dirPath, sub))) videoBearing.push(sub);
  }

  if (videoBearing.length === 0) return "empty";
  if (videoBearing.length === 1) return "course";

  if (videoBearing.some(looksLikeSeparateInstallment)) return "section";

  const allInternalStructure = videoBearing.every(looksLikeInternalStructure);
  return allInternalStructure ? "course" : "section";
}
