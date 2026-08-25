import { basename, dirname, relative, sep } from "node:path";
import type { ScanSummary } from "@lecturn/shared";
import { buildCourseTree, type ParsedNode } from "./buildCourseTree.js";
import { cleanFilename } from "./titleSuggest.js";
import { getLibraryById, touchLibraryScanned } from "../db/repositories/librariesRepo.js";
import { createCourse, getCourseByFolderPath, listCoursesUnderPath } from "../db/repositories/coursesRepo.js";
import { flagMissingNodes, getNodeByCoursePath, insertNode, refreshNodeOnRescan } from "../db/repositories/nodesRepo.js";
import { ensureVideoMetaRow } from "../db/repositories/videoMetaRepo.js";
import { replaceSubtitleTracks } from "../db/repositories/subtitleTracksRepo.js";
import { logger } from "../utils/logger.js";

export interface IngestSummary {
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
}

// The DB layer (better-sqlite3 via Drizzle) is fully synchronous — all fs
// reads already happened in buildCourseTree — so persisting a parsed tree
// needs no async/await of its own.
function persistTree(courseId: number, parsedNodes: ParsedNode[], parentId: number | null, seenPaths: string[], summary: IngestSummary) {
  parsedNodes.forEach((parsed, index) => {
    seenPaths.push(parsed.relativePath);
    let row = getNodeByCoursePath(courseId, parsed.relativePath);
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
      });
    } else {
      refreshNodeOnRescan(row.id, index, row.orderLocked);
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
      persistTree(courseId, parsed.children, row.id, seenPaths, summary);
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

  let course = getCourseByFolderPath(dirPath);
  if (!course) {
    course = createCourse({
      folderPath: dirPath,
      // Never auto-assigned — the admin assigns a course into a section
      // manually, and a rescan must never overwrite that choice.
      sectionId: null,
      title: courseNfo?.title || cleanFilename(basename(dirPath)),
      description: courseNfo?.description ?? null,
      topLevelFolder,
    });
  }

  const seenPaths: string[] = [];
  persistTree(course.id, tree, null, seenPaths, summary);
  summary.missingFlagged += flagMissingNodes(course.id, seenPaths);
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
export async function scanLibrary(libraryId: number): Promise<ScanSummary> {
  const library = getLibraryById(libraryId);
  if (!library) throw new Error(`Library ${libraryId} not found`);

  const summary = {
    coursesFound: 0,
    videosFound: 0,
    filesFound: 0,
    missingFlagged: 0,
    archivesSkipped: 0,
  };

  const existingCourses = listCoursesUnderPath(library.rootPath);
  for (const course of existingCourses) {
    const ingested = await ingestCourseFolder(course.folderPath, course.topLevelFolder);
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
