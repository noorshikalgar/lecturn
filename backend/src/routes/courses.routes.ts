import { assignCourseSectionSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getCourseById, listCourses, listRecentCourses, setCourseSection } from "../db/repositories/coursesRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";
import { getCourseTree } from "../services/courseTreeService.js";

export const coursesRouter = Router();

// Only used by the admin Path/Collection editor's "add a course" picker —
// deliberately unfiltered so an admin can curate from the full library.
coursesRouter.get("/", requireAdmin, (_req, res) => {
  res.json({ courses: listCourses() });
});

// Registered before /:id — otherwise "recent" would be parsed as an :id param.
coursesRouter.get("/recent", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const courses = listRecentCourses().filter((c) => visibility.canSeeCourseSection(c.sectionId));
  res.json({ courses });
});

coursesRouter.get("/:id", (req, res, next) => {
  const course = getCourseById(Number(req.params.id));
  if (!course || !getSectionVisibility(req.user!).canSeeCourseSection(course.sectionId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  res.json({ course, tree: getCourseTree(course.id) });
});

coursesRouter.patch("/:id/section", requireAdmin, validateBody(assignCourseSectionSchema), (req, res, next) => {
  const id = Number(req.params.id);
  if (!getCourseById(id)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  setCourseSection(id, req.body.sectionId);
  res.json({ course: getCourseById(id) });
});
