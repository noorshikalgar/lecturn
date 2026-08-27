import { createSectionSchema, setSectionAccessSchema, setSectionHiddenSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createSection, deleteSection, getSectionById, listSections, setSectionHidden } from "../db/repositories/sectionsRepo.js";
import { listCoursesBySection } from "../db/repositories/coursesRepo.js";
import { getSectionAccessUserIds, setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { listUsers } from "../db/repositories/usersRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";

export const sectionsRouter = Router();

sectionsRouter.get("/", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const sections = listSections().filter((s) => visibility.canSeeSection(s.id));
  res.json({ sections });
});

sectionsRouter.get("/:id/courses", (req, res, next) => {
  const id = Number(req.params.id);
  const visibility = getSectionVisibility(req.user!);
  if (!visibility.canSeeSection(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  const courses = listCoursesBySection(id, req.user!.id).filter((c) => visibility.canSeeCourse(c));
  res.json({ courses });
});

sectionsRouter.post("/", requireAdmin, validateBody(createSectionSchema), (req, res) => {
  res.status(201).json({ section: createSection(req.body.title) });
});

sectionsRouter.delete("/:id", requireAdmin, (req, res) => {
  deleteSection(Number(req.params.id));
  res.status(204).end();
});

sectionsRouter.patch("/:id/hidden", requireAdmin, validateBody(setSectionHiddenSchema), (req, res, next) => {
  const id = Number(req.params.id);
  if (!getSectionById(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  setSectionHidden(id, req.body.hidden);
  res.json({ section: getSectionById(id) });
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
  const validUserIds = new Set(listUsers().map((u) => u.id));
  const unknown = (req.body.userIds as number[]).filter((userId) => !validUserIds.has(userId));
  if (unknown.length > 0) {
    next(new ApiHttpError(400, "unknown_user", `Unknown user id(s): ${unknown.join(", ")}`));
    return;
  }
  setSectionAccess(id, req.body.userIds);
  res.json({ userIds: getSectionAccessUserIds(id) });
});
