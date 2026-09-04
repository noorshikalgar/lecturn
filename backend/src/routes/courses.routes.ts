import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assignCourseSectionSchema, relinkCourseSchema, setCourseHiddenSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import {
  deleteCourse,
  getCourseByFolderPath,
  getCourseById,
  listCourses,
  listRecentCourses,
  listUnassignedCourses,
  searchCourses,
  setCourseFolderPath,
  setCourseHidden,
  setCourseSection,
} from "../db/repositories/coursesRepo.js";
import { searchNodesByTitle } from "../db/repositories/nodesRepo.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";
import { listRecentCollections, listUnassignedCollections, searchCollections } from "../db/repositories/collectionsRepo.js";
import { searchNotesForUser } from "../db/repositories/notesRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";
import { getCourseTree } from "../services/courseTreeService.js";
import { ingestCourseFolder } from "../scanner/scanLibrary.js";

export const coursesRouter = Router();

// Only used by the admin Path/Collection editor's "add a course" picker —
// deliberately unfiltered so an admin can curate from the full library.
coursesRouter.get("/", requireAdmin, (req, res) => {
  res.json({ courses: listCourses(req.user!.id) });
});

// Registered before /:id — otherwise "recent"/"unassigned" would be parsed
// as an :id param. Not admin-gated — canSeeCourse already restricts
// unassigned courses to admins, so this naturally comes back empty for
// everyone else rather than needing a separate check here.
coursesRouter.get("/unassigned", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const courses = listUnassignedCourses(req.user!.id).filter((c) => visibility.canSeeCourse(c));
  const collections = listUnassignedCollections().filter((c) => visibility.canSeeCollection(c));
  res.json({ courses, collections });
});

coursesRouter.get("/recent", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  const courses = listRecentCourses(req.user!.id).filter((c) => visibility.canSeeCourse(c));
  const collections = listRecentCollections().filter((c) => visibility.canSeeCollection(c));
  res.json({ courses, collections });
});

const SEARCH_LIMIT = 20;

coursesRouter.get("/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json({ courses: [], collections: [], nodes: [], notes: [] });
    return;
  }
  const visibility = getSectionVisibility(req.user!);
  // Fetch more than the final limit — visibility filtering happens after
  // the DB query, so a plain LIMIT could under-fill the response if some
  // matches belong to a section this user can't see.
  const courses = searchCourses(q, req.user!.id, SEARCH_LIMIT * 2)
    .filter((c) => visibility.canSeeCourse(c))
    .slice(0, SEARCH_LIMIT);

  const collections = searchCollections(q, SEARCH_LIMIT * 2)
    .filter((c) => visibility.canSeeCollection(c))
    .slice(0, SEARCH_LIMIT);

  const nodeMatches = searchNodesByTitle(q, SEARCH_LIMIT * 2)
    .filter((n) => visibility.canSeeCourse({ sectionId: n.courseSectionId, hidden: n.courseHidden }))
    .slice(0, SEARCH_LIMIT)
    .map(({ courseSectionId: _s, courseHidden: _h, ...rest }) => rest);

  const noteMatches = searchNotesForUser(req.user!.id, q, SEARCH_LIMIT * 2)
    .filter((n) => visibility.canSeeCourse({ sectionId: n.courseSectionId, hidden: n.courseHidden }))
    .slice(0, SEARCH_LIMIT)
    .map(({ courseSectionId: _s, courseHidden: _h, ...rest }) => rest);

  res.json({ courses, collections, nodes: nodeMatches, notes: noteMatches });
});

coursesRouter.get("/:id", (req, res, next) => {
  const course = getCourseById((req.params.id as string));
  if (!course || !getSectionVisibility(req.user!).canSeeCourse(course)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  res.json({ course, tree: getCourseTree(course.id) });
});

coursesRouter.patch("/:id/section", requireAdmin, validateBody(assignCourseSectionSchema), (req, res, next) => {
  const id = (req.params.id as string);
  const course = getCourseById(id);
  if (!course) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  if (course.collectionId) {
    next(new ApiHttpError(400, "grouped_course", "This course belongs to a collection — assign the collection to a section instead"));
    return;
  }
  setCourseSection(id, req.body.sectionId);
  logActivity({
    type: "course_section_assigned",
    actorUserId: req.user!.id,
    targetType: "course",
    targetId: id,
    message: req.body.sectionId
      ? `${req.user!.username} assigned "${course.title}" to a section`
      : `${req.user!.username} removed "${course.title}" from its section`,
  });
  res.json({ course: getCourseById(id) });
});

coursesRouter.patch("/:id/hidden", requireAdmin, validateBody(setCourseHiddenSchema), (req, res, next) => {
  const id = (req.params.id as string);
  const course = getCourseById(id);
  if (!course) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  setCourseHidden(id, req.body.hidden);
  logActivity({
    type: "course_hidden_changed",
    actorUserId: req.user!.id,
    targetType: "course",
    targetId: id,
    message: `${req.user!.username} ${req.body.hidden ? "hid" : "unhid"} "${course.title}"`,
  });
  res.json({ course: getCourseById(id) });
});

// Re-points a course whose folder was renamed/moved on disk outside the app
// (folderPath is the course's identity, so a rename otherwise orphans it —
// see listOrphanedCoursesForLibrary). Re-ingests immediately so title/tree
// refresh without waiting for the next scan.
coursesRouter.patch("/:id/relink", requireAdmin, validateBody(relinkCourseSchema), async (req, res, next) => {
  const id = (req.params.id as string);
  const course = getCourseById(id);
  if (!course) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  const folderPath = resolve(req.body.folderPath);
  if (!existsSync(folderPath)) {
    next(new ApiHttpError(404, "not_found", "That folder doesn't exist on disk"));
    return;
  }
  const conflict = getCourseByFolderPath(folderPath);
  if (conflict && conflict.id !== id) {
    next(new ApiHttpError(409, "already_a_course", "That folder is already marked as a different course"));
    return;
  }
  try {
    setCourseFolderPath(id, folderPath);
    await ingestCourseFolder(folderPath, course.topLevelFolder);
    res.json({ course: getCourseById(id) });
  } catch (err) {
    next(err);
  }
});

coursesRouter.delete("/:id", requireAdmin, (req, res, next) => {
  const id = (req.params.id as string);
  const course = getCourseById(id);
  if (!course) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  deleteCourse(id);
  logActivity({
    type: "course_unmarked",
    actorUserId: req.user!.id,
    targetType: "course",
    targetId: id,
    message: `${req.user!.username} unmarked "${course.title}" as a course`,
  });
  res.status(204).end();
});
