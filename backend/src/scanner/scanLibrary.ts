import { join } from "node:path";
import type { ScanSummary } from "@lecturn/shared";
import { readDirContents } from "./fsWalk.js";
import { buildCourseTree, type ParsedNode } from "./buildCourseTree.js";
import { cleanFilename } from "./titleSuggest.js";
import { getLibraryById, touchLibraryScanned } from "../db/repositories/librariesRepo.js";
import { createCourse, getCourseByFolderPath } from "../db/repositories/coursesRepo.js";
import { flagMissingNodes, getNodeByCoursePath, insertNode, refreshNodeOnRescan } from "../db/repositories/nodesRepo.js";
import { ensureVideoMetaRow } from "../db/repositories/videoMetaRepo.js";
import { replaceSubtitleTracks } from "../db/repositories/subtitleTracksRepo.js";
import { logger } from "../utils/logger.js";

interface MutableSummary {
  coursesFound: number;
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
  emptyFoldersSkipped: number;
}

// The DB layer (better-sqlite3 via Drizzle) is fully synchronous — all fs
// reads already happened in buildCourseTree — so persisting a parsed tree
// needs no async/await of its own.
function persistTree(courseId: number, parsedNodes: ParsedNode[], parentId: number | null, seenPaths: string[], summary: MutableSummary) {
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

// A course is always exactly the folder two levels under the library root
// (library root / top-level folder / course folder) — no heuristic guessing.
// topLevelFolder is purely a display label for the admin's section-assignment
// screen; sections themselves are never derived from it.
async function ingestCourse(dirPath: string, dirName: string, topLevelFolder: string, summary: MutableSummary) {
  const { tree, archivesSkipped, courseNfo } = await buildCourseTree(dirPath);
  summary.archivesSkipped += archivesSkipped;

  if (tree.length === 0) {
    // No video/file content anywhere in this subtree (e.g. an empty folder,
    // or one containing only an unextracted archive) — not a real course.
    summary.emptyFoldersSkipped += 1;
    return;
  }

  let course = getCourseByFolderPath(dirPath);
  if (!course) {
    course = createCourse({
      folderPath: dirPath,
      // Never auto-assigned — the admin assigns a course into a section
      // manually, and a rescan must never overwrite that choice.
      sectionId: null,
      title: courseNfo?.title || cleanFilename(dirName),
      description: courseNfo?.description ?? null,
      topLevelFolder,
    });
  }
  summary.coursesFound += 1;

  const seenPaths: string[] = [];
  persistTree(course.id, tree, null, seenPaths, summary);
  summary.missingFlagged += flagMissingNodes(course.id, seenPaths);
}

export async function scanLibrary(libraryId: number): Promise<ScanSummary> {
  const library = getLibraryById(libraryId);
  if (!library) throw new Error(`Library ${libraryId} not found`);

  const summary: MutableSummary = {
    coursesFound: 0,
    videosFound: 0,
    filesFound: 0,
    missingFlagged: 0,
    archivesSkipped: 0,
    emptyFoldersSkipped: 0,
  };

  const rootContents = await readDirContents(library.rootPath);
  // Unextracted archives or stray files sitting directly at the library root
  // (not inside a top-level/course folder pair) are outside the fixed
  // depth-2 course rule — still worth counting so the admin can see them.
  summary.archivesSkipped += rootContents.archiveFiles.length;

  for (const topLevelName of rootContents.subdirs) {
    const topLevelPath = join(library.rootPath, topLevelName);
    const topLevelContents = await readDirContents(topLevelPath);
    summary.archivesSkipped += topLevelContents.archiveFiles.length;

    for (const courseName of topLevelContents.subdirs) {
      await ingestCourse(join(topLevelPath, courseName), courseName, topLevelName, summary);
    }
  }

  touchLibraryScanned(libraryId);
  logger.info({ libraryId, ...summary }, "Library scan complete");

  return { libraryId, ...summary, scannedAt: new Date().toISOString() };
}
