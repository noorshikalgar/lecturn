import { createSectionSchema, reorderSectionsSchema, setSectionAccessSchema, setSectionHiddenSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import {
  createSection,
  deleteSection,
  getSectionById,
  listSections,
  reorderSections,
  setSectionHidden,
} from "../db/repositories/sectionsRepo.js";
import { listCoursesBySection } from "../db/repositories/coursesRepo.js";
import { listCollectionsBySection } from "../db/repositories/collectionsRepo.js";
import { getSectionAccessUserIds, setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { listUsers } from "../db/repositories/usersRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";

export const sectionsRouter = Router();

sectionsRouter.get("/", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const sections = listSections().filter((s) => visibility.canSeeSection(s.id));
  res.json({ sections });
});

sectionsRouter.get("/:id/courses", (req, res, next) => {
  const id = (req.params.id as string);
  const visibility = getSectionVisibility(req.user!);
  if (!visibility.canSeeSection(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  const courses = listCoursesBySection(id, req.user!.id).filter((c) => visibility.canSeeCourse(c));
  const collections = listCollectionsBySection(id).filter((c) => visibility.canSeeCollection(c));
  res.json({ courses, collections });
});

sectionsRouter.post("/", requireAdmin, validateBody(createSectionSchema), (req, res) => {
  const section = createSection(req.body.title);
  logActivity({
    type: "section_created",
    actorUserId: req.user!.id,
    targetType: "section",
    targetId: section.id,
    message: `${req.user!.username} created section "${section.title}"`,
  });
  res.status(201).json({ section });
});

sectionsRouter.delete("/:id", requireAdmin, (req, res) => {
  const id = (req.params.id as string);
  const section = getSectionById(id);
  deleteSection(id);
  logActivity({
    type: "section_deleted",
    actorUserId: req.user!.id,
    targetType: "section",
    targetId: id,
    message: `${req.user!.username} deleted section "${section?.title ?? id}"`,
  });
  res.status(204).end();
});

// A plain literal path, not "/:id/reorder" — this reorders the sections
// list itself (there's nothing nested under a section to reorder).
sectionsRouter.post("/reorder", requireAdmin, validateBody(reorderSectionsSchema), (req, res) => {
  reorderSections(req.body.orderedSectionIds);
  res.json({ sections: listSections() });
});

sectionsRouter.patch("/:id/hidden", requireAdmin, validateBody(setSectionHiddenSchema), (req, res, next) => {
  const id = (req.params.id as string);
  const section = getSectionById(id);
  if (!section) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  setSectionHidden(id, req.body.hidden);
  logActivity({
    type: "section_hidden_changed",
    actorUserId: req.user!.id,
    targetType: "section",
    targetId: id,
    message: `${req.user!.username} ${req.body.hidden ? "hid" : "unhid"} section "${section.title}"`,
  });
  res.json({ section: getSectionById(id) });
});

sectionsRouter.get("/:id/access", requireAdmin, (req, res, next) => {
  const id = (req.params.id as string);
  if (!getSectionById(id)) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  res.json({ userIds: getSectionAccessUserIds(id) });
});

sectionsRouter.put("/:id/access", requireAdmin, validateBody(setSectionAccessSchema), (req, res, next) => {
  const id = (req.params.id as string);
  const section = getSectionById(id);
  if (!section) {
    next(new ApiHttpError(404, "not_found", "Section not found"));
    return;
  }
  const validUserIds = new Set(listUsers().map((u) => u.id));
  const unknown = (req.body.userIds as string[]).filter((userId) => !validUserIds.has(userId));
  if (unknown.length > 0) {
    next(new ApiHttpError(400, "unknown_user", `Unknown user id(s): ${unknown.join(", ")}`));
    return;
  }
  setSectionAccess(id, req.body.userIds);
  logActivity({
    type: "section_access_changed",
    actorUserId: req.user!.id,
    targetType: "section",
    targetId: id,
    message: `${req.user!.username} changed access for section "${section.title}" (${req.body.userIds.length} user(s))`,
  });
  res.json({ userIds: getSectionAccessUserIds(id) });
});
