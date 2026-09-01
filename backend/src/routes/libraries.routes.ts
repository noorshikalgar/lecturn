import { relative, resolve, sep } from "node:path";
import { existsSync } from "node:fs";
import { createLibrarySchema, markCourseFolderSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import {
  createLibrary,
  deleteLibrary,
  getLibraryById,
  getLibraryByRootPath,
  listLibraries,
  markScanCompleted,
  markScanFailed,
  markScanRunning,
} from "../db/repositories/librariesRepo.js";
import { listMissingForLibrary } from "../db/repositories/nodesRepo.js";
import { listCoursesUnderPath, listOrphanedCoursesForLibrary } from "../db/repositories/coursesRepo.js";
import { browseDirectory } from "../media/browseDirectory.js";
import { exploreLibrary } from "../media/exploreLibrary.js";
import { scanLibrary, isScanInProgress, ingestCourseFolder, topLevelFolderFor } from "../scanner/scanLibrary.js";
import { enqueueAllUnprobed } from "../jobs/probeQueue.js";
import { logger } from "../utils/logger.js";

export const librariesRouter = Router();

librariesRouter.use(requireAdmin);

librariesRouter.get("/", (_req, res) => {
  const libraries = listLibraries().map((lib) => ({
    ...lib,
    lastScanSummary: lib.lastScanSummary ? JSON.parse(lib.lastScanSummary) : null,
  }));
  res.json({ libraries });
});

// Registered before /:id — "browse" would otherwise be parsed as an :id.
librariesRouter.get("/browse", async (req, res, next) => {
  try {
    const result = await browseDirectory(typeof req.query.path === "string" ? req.query.path : "/");
    res.json(result);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      next(new ApiHttpError(404, "not_found", "That folder doesn't exist"));
    } else if (code === "EACCES" || code === "EPERM") {
      next(new ApiHttpError(403, "forbidden", "Permission denied reading that folder"));
    } else if (code === "ENOTDIR") {
      next(new ApiHttpError(400, "not_a_directory", "That path is not a folder"));
    } else {
      next(err);
    }
  }
});

librariesRouter.post("/", validateBody(createLibrarySchema), (req, res, next) => {
  if (getLibraryByRootPath(req.body.rootPath)) {
    next(new ApiHttpError(409, "already_a_library", "That folder is already a library"));
    return;
  }
  res.status(201).json({ library: createLibrary(req.body.rootPath) });
});

// Courses previously scanned from this library are deliberately left alone
// rather than cascade-deleted — their watch progress, notes, and
// certificates are real user data that "I removed this library entry" isn't
// a clear enough signal to destroy. They just stop being reachable through
// this library's own admin views, which is why the response says how many
// there were.
librariesRouter.delete("/:id", (req, res, next) => {
  const id = Number(req.params.id);
  const library = getLibraryById(id);
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  const affectedCourses = listCoursesUnderPath(library.rootPath).length;
  deleteLibrary(id);
  res.status(200).json({ affectedCourses });
});

// The scan itself runs detached from this request — a library this size can
// legitimately take longer than any reverse proxy's read timeout, and tying
// completion to one held-open HTTP response meant a slow client, a closed
// tab, or a proxy timeout looked identical to "the scan did nothing," even
// though the work kept running server-side regardless. Progress instead
// lives on the library row (see markScanRunning/Completed/Failed) — the
// admin UI polls it, and a page reload mid-scan just resumes reading the
// same state rather than losing track of it.
librariesRouter.post("/:id/scan", (req, res, next) => {
  const id = Number(req.params.id);
  if (!getLibraryById(id)) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  if (isScanInProgress(id)) {
    res.status(202).json({ status: "running" });
    return;
  }
  markScanRunning(id);
  res.status(202).json({ status: "running" });

  scanLibrary(id)
    .then((summary) => {
      markScanCompleted(id, summary);
      enqueueAllUnprobed();
    })
    .catch((err) => {
      logger.error({ err, libraryId: id }, "Background library scan failed");
      markScanFailed(id, err instanceof Error ? err.message : "Scan failed");
    });
});

librariesRouter.get("/:id/missing", (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  res.json({ missing: listMissingForLibrary(library.rootPath) });
});

librariesRouter.get("/:id/orphaned", (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  res.json({ orphaned: listOrphanedCoursesForLibrary(library.rootPath) });
});

librariesRouter.get("/:id/explore", async (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  try {
    const result = await exploreLibrary(library.rootPath, typeof req.query.path === "string" ? req.query.path : undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof RangeError) {
      next(new ApiHttpError(400, "outside_library", err.message));
      return;
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") next(new ApiHttpError(404, "not_found", "That folder doesn't exist"));
    else if (code === "EACCES" || code === "EPERM") next(new ApiHttpError(403, "forbidden", "Permission denied reading that folder"));
    else if (code === "ENOTDIR") next(new ApiHttpError(400, "not_a_directory", "That path is not a folder"));
    else next(err);
  }
});

librariesRouter.post("/:id/mark-course", validateBody(markCourseFolderSchema), async (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  const folderPath = resolve(req.body.folderPath);
  const rel = relative(library.rootPath, folderPath);
  if (rel === ".." || rel.startsWith(`..${sep}`) || folderPath === library.rootPath) {
    next(new ApiHttpError(400, "outside_library", "That folder isn't inside this library, or is the library root itself"));
    return;
  }
  if (!existsSync(folderPath)) {
    next(new ApiHttpError(404, "not_found", "That folder doesn't exist on disk"));
    return;
  }
  try {
    await ingestCourseFolder(folderPath, topLevelFolderFor(library.rootPath, folderPath));
    enqueueAllUnprobed();
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
