import { createSectionSchema, setSectionAccessSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createSection, deleteSection, getSectionById, listSections } from "../db/repositories/sectionsRepo.js";
import { listCoursesBySection, listUnassignedCourses } from "../db/repositories/coursesRepo.js";
import { getSectionAccessUserIds, setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";

export const sectionsRouter = Router();

sectionsRouter.get("/", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const sections = listSections().filter((s) => visibility.canSeeSection(s.id));
  res.json({ sections });
});

sectionsRouter.get("/:id/courses", (req, res, next) => {
  const id = Number(req.params.id);
  if (!getSectionVisibility(req.user!).canSeeSection(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  res.json({ courses: listCoursesBySection(id) });
});

sectionsRouter.post("/", requireAdmin, validateBody(createSectionSchema), (req, res) => {
  res.status(201).json({ section: createSection(req.body.title) });
});

sectionsRouter.delete("/:id", requireAdmin, (req, res) => {
  deleteSection(Number(req.params.id));
  res.status(204).end();
});

sectionsRouter.get("/:id/access", requireAdmin, (req, res, next) => {
  const id = Number(req.params.id);
  if (!getSectionById(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  res.json({ userIds: getSectionAccessUserIds(id) });
});

sectionsRouter.put("/:id/access", requireAdmin, validateBody(setSectionAccessSchema), (req, res, next) => {
  const id = Number(req.params.id);
  if (!getSectionById(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  setSectionAccess(id, req.body.userIds);
  res.json({ userIds: getSectionAccessUserIds(id) });
});

// Admin-only: courses scanned but not yet assigned into a section, grouped
// by their topLevelFolder on the client side for easier bulk assignment.
sectionsRouter.get("/unassigned-courses", requireAdmin, (_req, res) => {
  res.json({ courses: listUnassignedCourses() });
});
