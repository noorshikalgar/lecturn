import { existsSync, unlinkSync } from "node:fs";
import { basename, dirname, relative, sep } from "node:path";
import type { ScanSummary } from "@lecturn/shared";
import { buildCourseTree, type ParsedNode } from "./buildCourseTree.js";
import { cleanFolderName } from "./titleSuggest.js";
import { getLibraryById, touchLibraryScanned } from "../db/repositories/librariesRepo.js";
import {
  createCourse,
  getCourseByFolderPath,
  listCoursesUnderPath,
  setCourseCollection,
  setCourseDescription,
  setCourseDuration,
  setCourseTitle,
} from "../db/repositories/coursesRepo.js";
import { listCollections } from "../db/repositories/collectionsRepo.js";
import {
  deleteEmptyMissingGroups,
  findRenameCandidate,
  flagMissingNodes,
  getNodeByCoursePath,
  insertNode,
  refreshNodeOnRescan,
  renameNode,
  updateNodeFingerprint,
} from "../db/repositories/nodesRepo.js";
import { ensureVideoMetaRow, resetVideoProbe, sumProbedDurationForCourse } from "../db/repositories/videoMetaRepo.js";
import { replaceSubtitleTracks } from "../db/repositories/subtitleTracksRepo.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";
import { remuxCachePath } from "../media/remux.js";
import { logger } from "../utils/logger.js";
import { ApiHttpError } from "../middleware/errorHandler.js";

export interface IngestSummary {
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
}

// A renamed/moved video's cached remux is keyed by node id and untouched by
// the rename itself (same content, so the cache is still correct) — nothing
// to invalidate there. Only a genuine content swap at an unchanged path
// needs its cache dropped (see the "content replaced" branch below).
function invalidateStaleRemux(nodeId: string) {
  const cached = remuxCachePath(nodeId);
  if (existsSync(cached)) {
    try {
      unlinkSync(cached);
    } catch (err) {
      logger.warn({ err, nodeId }, "Failed to remove stale remux cache after content change");
    }
  }
}

// The DB layer (better-sqlite3 via Drizzle) is fully synchronous — all fs
// reads already happened in buildCourseTree — so persisting a parsed tree
// needs no async/await of its own.
//
// Node identity across a rescan is deliberately NOT just (courseId,
// relativePath): renaming or moving files on disk is routine library
// upkeep, not something that should ever cost a viewer their watch
// progress or an admin their manually-set lecture title. So:
//   - exact relativePath match  -> same node, same file (the common case).
//   - exact relativePath match, but the file's content fingerprint changed
//     -> same node, file was *replaced* at that path (re-encoded/re-
//     downloaded) — keep progress (there's no reliable way to know whether
//     that's still wanted, and silently deleting a viewer's history is the
//     worse of the two wrong guesses), but the old probed duration/codec
//     and any cached remux are now for a different file entirely, so both
//     get invalidated.
//   - no relativePath match, but some other node in the course has the same
//     content fingerprint -> the file was renamed and/or moved to a
//     different folder; that node is updated in place (path, parent,
//     order) instead of the old one being flagged missing and a fresh,
//     zero-progress node inserted for the "new" file.
//   - no relativePath match and no fingerprint match -> genuinely new.
function persistTree(
  courseId: string,
  parsedNodes: ParsedNode[],
  parentId: string | null,
  seenPaths: string[],
  renamedNodeIds: string[],
  summary: IngestSummary,
) {
  parsedNodes.forEach((parsed, index) => {
    seenPaths.push(parsed.relativePath);
    let row = getNodeByCoursePath(courseId, parsed.relativePath);
    if (row) {
      refreshNodeOnRescan(row.id, index, parentId, parsed.title);
      if (parsed.contentFingerprint && row.contentFingerprint && parsed.contentFingerprint !== row.contentFingerprint) {
        updateNodeFingerprint(row.id, parsed.contentFingerprint);
        if (parsed.type === "video") {
          resetVideoProbe(row.id);
          invalidateStaleRemux(row.id);
        }
      } else if (parsed.contentFingerprint && !row.contentFingerprint) {
        // Upgraded from before fingerprinting existed, or a stat/read
        // failure skipped it on a previous scan — just backfill, no reason
        // to assume the content changed.
        updateNodeFingerprint(row.id, parsed.contentFingerprint);
      }
    } else if (parsed.contentFingerprint) {
      const candidate = findRenameCandidate(courseId, parsed.type, parsed.contentFingerprint, renamedNodeIds);
      if (candidate) {
        renamedNodeIds.push(candidate.id);
        renameNode(candidate.id, {
          relativePath: parsed.relativePath,
          parentId,
          rawName: parsed.rawName,
          title: parsed.title,
          orderIndex: index,
        });
        row = candidate;
      }
    }

    if (!row) {
      row = insertNode({
        courseId,
        parentId,
        type: parsed.type,
        title: parsed.title,
        rawName: parsed.rawName,
        orderIndex: index,
        relativePath: parsed.relativePath,
        targetUrl: parsed.targetUrl ?? null,
        contentFingerprint: parsed.contentFingerprint,
      });
    }

    if (parsed.type === "video") {
      summary.videosFound += 1;
      ensureVideoMetaRow(row.id);
      replaceSubtitleTracks(
        row.id,
        (parsed.subtitles ?? []).map((s) => ({
          label: s.label,
          sourceFormat: s.format,
          sourcePath: s.relativePath,
        })),
      );
    } else if (parsed.type === "file" || parsed.type === "link") {
      summary.filesFound += 1;
    }

    if (parsed.type === "group" && parsed.children) {
      persistTree(courseId, parsed.children, row.id, seenPaths, renamedNodeIds, summary);
    }
  });
}

// Creates a course from this exact folder if one doesn't already exist there
// (idempotent — if it does, this just refreshes it, same as a rescan would).
// There's no depth rule or heuristic anymore: which folder is "a course" is
// entirely the admin's call, made explicitly via the Library Explorer's
// "Mark as Course" action. topLevelFolder is purely a display label for the
// admin's grouping views, computed from whatever the folder's immediate
// parent happens to be — it plays no role in classification.
export async function ingestCourseFolder(dirPath: string, topLevelFolder: string | null): Promise<IngestSummary> {
  const summary: IngestSummary = { videosFound: 0, filesFound: 0, missingFlagged: 0, archivesSkipped: 0 };
  const { tree, archivesSkipped, courseNfo } = await buildCourseTree(dirPath);
  summary.archivesSkipped += archivesSkipped;

  const derivedTitle = courseNfo?.title || cleanFolderName(basename(dirPath));
  const derivedDescription = courseNfo?.description ?? null;

  let course = getCourseByFolderPath(dirPath);
  if (!course) {
    course = createCourse({
      folderPath: dirPath,
      // Never auto-assigned — the admin assigns a course into a section
      // manually, and a rescan must never overwrite that choice.
      sectionId: null,
      title: derivedTitle,
      description: derivedDescription,
      topLevelFolder,
    });
    // Mirrors createCollection's own retroactive grouping, just in the
    // other direction: a course marked *after* its parent collection
    // already exists still ends up grouped, without a separate manual
    // step. Only checked at creation, not on every rescan — an admin
    // removing a course from its collection later must stick, the same
    // way sectionId above never gets silently reassigned either.
    const parentCollection = listCollections().find((c) => dirPath.startsWith(`${c.folderPath}${sep}`));
    if (parentCollection) setCourseCollection(course.id, parentCollection.id);
  } else {
    // Title/description aren't admin-editable yet (no route uses
    // setCourseTitle/setCourseDescription), so re-deriving them on every
    // rescan is safe — e.g. deleting a stale season.nfo should make the
    // title fall back to the folder name on the next rescan, not stay
    // stuck on whatever it picked up the first time.
    setCourseTitle(course.id, derivedTitle);
    setCourseDescription(course.id, derivedDescription);
  }

  const seenPaths: string[] = [];
  const renamedNodeIds: string[] = [];
  persistTree(course.id, tree, null, seenPaths, renamedNodeIds, summary);
  const newlyMissing = flagMissingNodes(course.id, seenPaths);
  summary.missingFlagged += newlyMissing;
  // Cleans up the wrapper groups a folder-per-lecture layout used to get
  // before buildCourseTree started flattening "folder wraps one identically-
  // titled item" into just that item — the group is now missing (nothing
  // reproduces its path) and childless (its lone child got re-parented
  // above it instead), so it's pure ghost-chapter clutter, not something an
  // admin needs to see or recover.
  deleteEmptyMissingGroups(course.id);
  // The stored duration is denormalized and otherwise only refreshed when a
  // *new* video gets probed (see probeQueue.ts) — without this, deleting
  // videos and rescanning flags them missing but the course's total
  // duration keeps counting seconds from files that no longer exist.
  if (newlyMissing > 0) setCourseDuration(course.id, sumProbedDurationForCourse(course.id));
  return summary;
}

export function topLevelFolderFor(libraryRootPath: string, courseFolderPath: string): string | null {
  const rel = relative(libraryRootPath, dirname(courseFolderPath));
  if (!rel || rel.startsWith("..")) return null;
  return rel.split(sep)[0] || null;
}

// Rescanning no longer discovers new courses — it only refreshes courses the
// admin has already explicitly marked (new/removed/renamed files inside
// their subtree, missing-file flags). New courses are created exclusively
// via the Library Explorer's "Mark as Course" action.
// scanLibrary is only ever "safe" under concurrent calls by accident — two
// overlapping scans of the same library would both read/write the same
// course rows with no coordination. Guard explicitly instead of relying on
// callers never doing that.
const scansInProgress = new Set<string>();

// Lets the route decide whether to launch a new detached scan or just report
// "already running" without unwrapping the 409 scanLibrary itself throws.
export function isScanInProgress(libraryId: string): boolean {
  return scansInProgress.has(libraryId);
}

export async function scanLibrary(libraryId: string): Promise<ScanSummary> {
  const library = getLibraryById(libraryId);
  if (!library) throw new Error(`Library ${libraryId} not found`);

  if (scansInProgress.has(libraryId)) {
    throw new ApiHttpError(409, "scan_in_progress", "This library is already being scanned");
  }
  scansInProgress.add(libraryId);
  try {
    return await scanLibraryInternal(libraryId, library);
  } finally {
    scansInProgress.delete(libraryId);
  }
}

async function scanLibraryInternal(libraryId: string, library: NonNullable<ReturnType<typeof getLibraryById>>): Promise<ScanSummary> {
  const summary = {
    coursesFound: 0,
    videosFound: 0,
    filesFound: 0,
    missingFlagged: 0,
    archivesSkipped: 0,
    coursesOrphaned: 0,
  };

  const existingCourses = listCoursesUnderPath(library.rootPath);
  for (const course of existingCourses) {
    let ingested: IngestSummary;
    try {
      ingested = await ingestCourseFolder(course.folderPath, course.topLevelFolder);
    } catch (err) {
      // Folder renamed/moved/deleted outside the app since it was marked, or
      // its permissions changed so we can no longer read it — either way,
      // don't let one bad course abort the whole library scan. Orphaned ones
      // show up via listOrphanedCoursesForLibrary for the admin to relink or
      // drop; an EACCES one is left alone and simply retried next scan.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        logger.warn({ courseId: course.id, folderPath: course.folderPath }, "Course folder missing on rescan, skipping");
        summary.coursesOrphaned += 1;
        logActivity({
          type: "course_orphaned",
          actorUserId: null,
          targetType: "course",
          targetId: course.id,
          message: `Course "${course.title}" is orphaned — its folder "${course.folderPath}" is missing`,
        });
        continue;
      }
      if (code === "EACCES" || code === "EPERM") {
        logger.warn({ courseId: course.id, folderPath: course.folderPath, code }, "Course folder unreadable on rescan, skipping");
        continue;
      }
      throw err;
    }
    summary.coursesFound += 1;
    summary.videosFound += ingested.videosFound;
    summary.filesFound += ingested.filesFound;
    summary.missingFlagged += ingested.missingFlagged;
    summary.archivesSkipped += ingested.archivesSkipped;
  }

  touchLibraryScanned(libraryId);
  logger.info({ libraryId, ...summary }, "Library scan complete");

  return { libraryId, ...summary, scannedAt: new Date().toISOString() };
}
