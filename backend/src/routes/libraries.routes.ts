import { createLibrarySchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createLibrary, deleteLibrary, getLibraryById, listLibraries } from "../db/repositories/librariesRepo.js";
import { listMissingForLibrary } from "../db/repositories/nodesRepo.js";
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

librariesRouter.get("/:id/missing", (req, res, next) => {
  const library = getLibraryById(Number(req.params.id));
  if (!library) {
    next(new ApiHttpError(404, "not_found", "Library not found"));
    return;
  }
  res.json({ missing: listMissingForLibrary(library.rootPath) });
});
