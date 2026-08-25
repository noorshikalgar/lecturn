import { dirname } from "node:path";
import { createLibrarySchema, reclassifyFolderSchema } from "@coursedeck/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createLibrary, deleteLibrary, getLibraryById, listLibraries } from "../db/repositories/librariesRepo.js";
import { listCourses, deleteCourseByFolderPath } from "../db/repositories/coursesRepo.js";
import { listSections, deleteSectionByFolderPath } from "../db/repositories/sectionsRepo.js";
import { listMissingForLibrary } from "../db/repositories/nodesRepo.js";
import { clearOverride, setOverride } from "../db/repositories/classificationOverridesRepo.js";
import { browseDirectory } from "../media/browseDirectory.js";
import { scanLibrary } from "../scanner/scanLibrary.js";
import { enqueueAllUnprobed } from "../jobs/probeQueue.js";

export const librariesRouter = Router();

librariesRouter.use(requireAdmin);

librariesRouter.get("/", (_req, res) => {
  res.json({ libraries: listLibraries() });
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

librariesRouter.post("/", validateBody(createLibrarySchema), (req, res) => {
  res.status(201).json({ library: createLibrary(req.body.rootPath) });
});

librariesRouter.delete("/:id", (req, res) => {
  deleteLibrary(Number(req.params.id));
  res.status(204).end();
});

librariesRouter.post("/:id/scan", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!getLibraryById(id)) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  try {
    const summary = await scanLibrary(id);
    enqueueAllUnprobed();
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

// Folders sitting directly under the library root — the only level the
// section-vs-course heuristic can guess wrong on in a way worth a manual
// toggle for (deeper folders are just internal course structure).
librariesRouter.get("/:id/top-level", (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  const topLevelSections = listSections(library.id).filter((s) => s.folderPath && dirname(s.folderPath) === library.rootPath);
  const topLevelCourses = listCourses().filter((c) => dirname(c.folderPath) === library.rootPath);

  res.json({
    entries: [
      ...topLevelSections.map((s) => ({ kind: "section" as const, id: s.id, title: s.title, folderPath: s.folderPath! })),
      ...topLevelCourses.map((c) => ({ kind: "course" as const, id: c.id, title: c.title, folderPath: c.folderPath })),
    ],
  });
});

librariesRouter.post("/:id/reclassify", validateBody(reclassifyFolderSchema), (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  const { folderPath, kind } = req.body;

  setOverride(folderPath, kind);
  // Remove the stale row of the OPPOSITE type at this exact path so the next
  // scan doesn't leave a dangling duplicate behind. Only ever touches the one
  // row matching this exact folderPath — never a pattern/prefix match.
  if (kind === "section") {
    deleteCourseByFolderPath(folderPath);
  } else {
    deleteSectionByFolderPath(library.id, folderPath);
  }
  res.status(204).end();
});

librariesRouter.delete("/:id/overrides", (req, res, next) => {
  const folderPath = req.query.folderPath as string | undefined;
  if (!folderPath) {
    next(new ApiHttpError(400, "missing_folder_path", "folderPath query param is required"));
    return;
  }
  clearOverride(folderPath);
  res.status(204).end();
});

librariesRouter.get("/:id/missing", (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  res.json({ missing: listMissingForLibrary(library.rootPath) });
});
