import { assignCourseSectionSchema, relinkCourseSchema, setCourseHiddenSchema } from "@lecturn/shared";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import {
  deleteCollection,
  getCollectionByFolderPath,
  getCollectionById,
  listCollections,
  setCollectionFolderPath,
  setCollectionHidden,
  setCollectionSection,
} from "../db/repositories/collectionsRepo.js";
import { getCourseById, listCoursesByCollection, setCourseCollection } from "../db/repositories/coursesRepo.js";
import { canUserAccessCollection } from "../services/sectionVisibility.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";

export const collectionsRouter = Router();

// Admin-only — the same "curate from the full library" picker role
// coursesRouter's bare GET / already plays for standalone courses.
collectionsRouter.get("/", requireAdmin, (_req, res) => {
  res.json({ collections: listCollections() });
});

collectionsRouter.get("/:id", (req, res, next) => {
  const id = req.params.id as string;
  if (!canUserAccessCollection(req.user!, id)) {
    next(new ApiHttpError(404, "not_found", "Collection not found"));
    return;
  }
  const collection = getCollectionById(id)!;
  // Not visibility.canSeeCourse(c) here — a grouped course's own sectionId
  // is always null (section membership lives on the collection now, see
  // setCourseCollection), and canSeeCourse treats a null sectionId as
  // "unassigned, admin-only." The outer canUserAccessCollection call above
  // already gated on the *collection's* section/hidden state; a child
  // course only needs its own independent hidden kill switch checked here.
  const courses = listCoursesByCollection(id, req.user!.id).filter((c) => req.user!.role === "admin" || !c.hidden);
  res.json({ collection: { ...collection, courses } });
});

collectionsRouter.patch("/:id/section", requireAdmin, validateBody(assignCourseSectionSchema), (req, res, next) => {
  const id = req.params.id as string;
  const collection = getCollectionById(id);
  if (!collection) {
    next(new ApiHttpError(404, "not_found", "Collection not found"));
    return;
  }
  setCollectionSection(id, req.body.sectionId);
  logActivity({
    type: "course_section_assigned",
    actorUserId: req.user!.id,
    targetType: "collection",
    targetId: id,
    message: req.body.sectionId
      ? `${req.user!.username} assigned collection "${collection.title}" to a section`
      : `${req.user!.username} removed collection "${collection.title}" from its section`,
  });
  res.json({ collection: getCollectionById(id) });
});

collectionsRouter.patch("/:id/hidden", requireAdmin, validateBody(setCourseHiddenSchema), (req, res, next) => {
  const id = req.params.id as string;
  const collection = getCollectionById(id);
  if (!collection) {
    next(new ApiHttpError(404, "not_found", "Collection not found"));
    return;
  }
  setCollectionHidden(id, req.body.hidden);
  logActivity({
    type: "course_hidden_changed",
    actorUserId: req.user!.id,
    targetType: "collection",
    targetId: id,
    message: `${req.user!.username} ${req.body.hidden ? "hid" : "unhid"} collection "${collection.title}"`,
  });
  res.json({ collection: getCollectionById(id) });
});

// Re-points a collection whose folder was renamed/moved on disk — same
// recovery path courses.routes.ts's own /:id/relink offers, since a
// collection's identity is its folderPath too.
collectionsRouter.patch("/:id/relink", requireAdmin, validateBody(relinkCourseSchema), (req, res, next) => {
  const id = req.params.id as string;
  const collection = getCollectionById(id);
  if (!collection) {
    next(new ApiHttpError(404, "not_found", "Collection not found"));
    return;
  }
  const folderPath = resolve(req.body.folderPath);
  if (!existsSync(folderPath)) {
    next(new ApiHttpError(404, "not_found", "That folder doesn't exist on disk"));
    return;
  }
  const conflict = getCollectionByFolderPath(folderPath);
  if (conflict && conflict.id !== id) {
    next(new ApiHttpError(409, "already_a_collection", "That folder is already marked as a different collection"));
    return;
  }
  setCollectionFolderPath(id, folderPath);
  res.json({ collection: getCollectionById(id) });
});

// Manually moves an existing standalone course into this collection — the
// scanner already does this automatically at mark-time (see scanLibrary.ts
// and createCollection), this is the escape hatch for a course that was
// marked before its parent collection existed and needs adding by hand.
collectionsRouter.put("/:id/courses/:courseId", requireAdmin, (req, res, next) => {
  const id = req.params.id as string;
  const courseId = req.params.courseId as string;
  const collection = getCollectionById(id);
  const course = getCourseById(courseId);
  if (!collection || !course) {
    next(new ApiHttpError(404, "not_found", "Collection or course not found"));
    return;
  }
  setCourseCollection(courseId, id);
  logActivity({
    type: "course_section_assigned",
    actorUserId: req.user!.id,
    targetType: "course",
    targetId: courseId,
    message: `${req.user!.username} added "${course.title}" to collection "${collection.title}"`,
  });
  res.json({ course: getCourseById(courseId) });
});

// Reverts a course to standalone — it keeps whatever section it had before
// only if that was never cleared; joining a collection always clears a
// course's own sectionId (see setCourseCollection), so this genuinely
// leaves it unassigned, not silently restoring a stale prior section.
collectionsRouter.delete("/:id/courses/:courseId", requireAdmin, (req, res, next) => {
  const id = req.params.id as string;
  const courseId = req.params.courseId as string;
  const course = getCourseById(courseId);
  if (!course || course.collectionId !== id) {
    next(new ApiHttpError(404, "not_found", "That course isn't in this collection"));
    return;
  }
  setCourseCollection(courseId, null);
  logActivity({
    type: "course_section_assigned",
    actorUserId: req.user!.id,
    targetType: "course",
    targetId: courseId,
    message: `${req.user!.username} removed "${course.title}" from its collection`,
  });
  res.json({ course: getCourseById(courseId) });
});

// Unmarking a collection never deletes its child courses — see
// collectionsRepo.ts's deleteCollection comment. They revert to standalone
// (collectionId cleared by the FK's ON DELETE SET NULL).
collectionsRouter.delete("/:id", requireAdmin, (req, res, next) => {
  const id = req.params.id as string;
  const collection = getCollectionById(id);
  if (!collection) {
    next(new ApiHttpError(404, "not_found", "Collection not found"));
    return;
  }
  deleteCollection(id);
  logActivity({
    type: "course_unmarked",
    actorUserId: req.user!.id,
    targetType: "collection",
    targetId: id,
    message: `${req.user!.username} unmarked collection "${collection.title}"`,
  });
  res.status(204).end();
});
