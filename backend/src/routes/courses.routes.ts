import { Router } from "express";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getCourseById, listCourses, listRecentCourses } from "../db/repositories/coursesRepo.js";
import { getCourseTree } from "../services/courseTreeService.js";

export const coursesRouter = Router();

coursesRouter.get("/", (_req, res) => {
  res.json({ courses: listCourses() });
});

// Registered before /:id — otherwise "recent" would be parsed as an :id param.
coursesRouter.get("/recent", (_req, res) => {
  res.json({ courses: listRecentCourses() });
});

coursesRouter.get("/:id", (req, res, next) => {
  const course = getCourseById(Number(req.params.id));
  if (!course) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  res.json({ course, tree: getCourseTree(course.id) });
});
