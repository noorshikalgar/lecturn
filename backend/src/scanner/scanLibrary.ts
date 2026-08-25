import { join } from "node:path";
import type { ScanSummary } from "@lecturn/shared";
import { classifyFolder } from "./classifyFolder.js";
import { readDirContents } from "./fsWalk.js";
import { buildCourseTree, type ParsedNode } from "./buildCourseTree.js";
import { cleanFilename } from "./titleSuggest.js";
import { getLibraryById, touchLibraryScanned } from "../db/repositories/librariesRepo.js";
import { getOverride } from "../db/repositories/classificationOverridesRepo.js";
import { getOrCreateSection } from "../db/repositories/sectionsRepo.js";
import { createCourse, getCourseByFolderPath } from "../db/repositories/coursesRepo.js";
import { flagMissingNodes, getNodeByCoursePath, insertNode, refreshNodeOnRescan } from "../db/repositories/nodesRepo.js";
import { ensureVideoMetaRow } from "../db/repositories/videoMetaRepo.js";
import { replaceSubtitleTracks } from "../db/repositories/subtitleTracksRepo.js";
import { logger } from "../utils/logger.js";

interface MutableSummary {
  sectionsFound: number;
  coursesFound: number;
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
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

async function ingestCourse(dirPath: string, dirName: string, sectionId: number | null, summary: MutableSummary) {
  const { tree, archivesSkipped, courseNfo } = await buildCourseTree(dirPath);
  summary.archivesSkipped += archivesSkipped;

  let course = getCourseByFolderPath(dirPath);
  if (!course) {
    course = createCourse({
      folderPath: dirPath,
      sectionId,
      title: courseNfo?.title || cleanFilename(dirName),
      description: courseNfo?.description ?? null,
    });
  }
  summary.coursesFound += 1;

  const seenPaths: string[] = [];
  persistTree(course.id, tree, null, seenPaths, summary);
  summary.missingFlagged += flagMissingNodes(course.id, seenPaths);
}

async function scanEntry(dirPath: string, dirName: string, libraryId: number, sectionId: number | null, summary: MutableSummary) {
  const override = getOverride(dirPath);
  const kind = override ? override.kind : await classifyFolder(dirPath);
  if (kind === "empty") return;
  if (kind === "course") {
    await ingestCourse(dirPath, dirName, sectionId, summary);
    return;
  }

  const section = getOrCreateSection(libraryId, dirPath, cleanFilename(dirName), summary.sectionsFound);
  summary.sectionsFound += 1;
  const { subdirs } = await readDirContents(dirPath);
  for (const sub of subdirs) {
    await scanEntry(join(dirPath, sub), sub, libraryId, section.id, summary);
  }
}

export async function scanLibrary(libraryId: number): Promise<ScanSummary> {
  const library = getLibraryById(libraryId);
  if (!library) throw new Error(`Library ${libraryId} not found`);

  const summary: MutableSummary = {
    sectionsFound: 0,
    coursesFound: 0,
    videosFound: 0,
    filesFound: 0,
    missingFlagged: 0,
    archivesSkipped: 0,
  };

  const rootContents = await readDirContents(library.rootPath);
  // Unextracted course archives sometimes sit directly at the library root
  // (not inside any course folder) — still worth counting so an admin can
  // see how many courses are waiting to be unzipped.
  summary.archivesSkipped += rootContents.archiveFiles.length;
  for (const sub of rootContents.subdirs) {
    await scanEntry(join(library.rootPath, sub), sub, libraryId, null, summary);
  }

  touchLibraryScanned(libraryId);
  logger.info({ libraryId, ...summary }, "Library scan complete");

  return { libraryId, ...summary, scannedAt: new Date().toISOString() };
}
