import { addCourseToPathSchema, createPathSchema, reorderPathCoursesSchema, updatePathSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import {
  addCourseToPath,
  createPath,
  deletePath,
  getPathById,
  isCourseInPath,
  listPathCourses,
  listPaths,
  removeCourseFromPath,
  reorderPathCourses,
  updatePath,
} from "../db/repositories/pathsRepo.js";
import { getCourseById } from "../db/repositories/coursesRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";

export const pathsRouter = Router();

pathsRouter.get("/", (_req, res) => {
  res.json({ paths: listPaths() });
});

// listPathCourses returns full course rows — a path can span any section,
// including ones this particular user can't see, so every read filters
// through the same visibility check as every other course listing in the
// app instead of trusting path membership alone.
pathsRouter.get("/:id", (req, res, next) => {
  const path = getPathById(Number(req.params.id));
  if (!path) {
    next(new ApiHttpError(404, "not_found", "Path not found"));
    return;
  }
  const visibility = getSectionVisibility(req.user!);
  const courses = listPathCourses(path.id, req.user!.id).filter((entry) => visibility.canSeeCourse(entry.course));
  res.json({ path, courses });
});

pathsRouter.post("/", requireAdmin, validateBody(createPathSchema), (req, res) => {
  const { title, description } = req.body;
  res.status(201).json({ path: createPath(title, description ?? null) });
});

pathsRouter.patch("/:id", requireAdmin, validateBody(updatePathSchema), (req, res, next) => {
  const id = Number(req.params.id);
  if (!getPathById(id)) {
    next(new ApiHttpError(404, "not_found", "Path not found"));
    return;
  }
  updatePath(id, req.body);
  res.json({ path: getPathById(id) });
});

pathsRouter.delete("/:id", requireAdmin, (req, res) => {
  deletePath(Number(req.params.id));
  res.status(204).end();
});

pathsRouter.post("/:id/courses", requireAdmin, validateBody(addCourseToPathSchema), (req, res, next) => {
  const pathId = Number(req.params.id);
  if (!getPathById(pathId)) {
    next(new ApiHttpError(404, "not_found", "Path not found"));
    return;
  }
  if (!getCourseById(req.body.courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  if (isCourseInPath(pathId, req.body.courseId)) {
    next(new ApiHttpError(409, "already_in_path", "That course is already in this path"));
    return;
  }
  addCourseToPath(pathId, req.body.courseId);
  res.status(201).json({ courses: listPathCourses(pathId, req.user!.id) });
});

pathsRouter.delete("/:id/courses/:courseId", requireAdmin, (req, res) => {
  removeCourseFromPath(Number(req.params.id), Number(req.params.courseId));
  res.status(204).end();
});

pathsRouter.post("/:id/reorder", requireAdmin, validateBody(reorderPathCoursesSchema), (req, res, next) => {
  const pathId = Number(req.params.id);
  if (!getPathById(pathId)) {
    next(new ApiHttpError(404, "not_found", "Path not found"));
    return;
  }
  reorderPathCourses(pathId, req.body.orderedCourseIds);
  res.json({ courses: listPathCourses(pathId, req.user!.id) });
});
