import { updateProgressSchema } from "@lecturn/shared";
import { Router } from "express";
import { validateBody } from "../middleware/validateBody.js";
import { getProgress, listContinueWatching, listProgressForCourse, upsertProgress } from "../db/repositories/progressRepo.js";
import { getSectionVisibility } from "../services/sectionVisibility.js";

export const progressRouter = Router();

const CONTINUE_WATCHING_LIMIT = 20;

progressRouter.get("/continue-watching", (req, res) => {
  const visibility = getSectionVisibility(req.user!);
  // Fetch extra before filtering — a straight LIMIT could under-fill the
  // response if some of a user's own watch history now belongs to a
  // section they've since lost access to (moved into a restricted section,
  // for instance).
  const items = listContinueWatching(req.user!.id, CONTINUE_WATCHING_LIMIT * 3)
    .filter((item) => visibility.canSeeCourse(item.course))
    .slice(0, CONTINUE_WATCHING_LIMIT);
  res.json({ items });
});

// Registered before /:videoNodeId — otherwise "course" would be parsed as a node id.
progressRouter.get("/course/:courseId", (req, res) => {
  res.json({ items: listProgressForCourse(req.user!.id, Number(req.params.courseId)) });
});

progressRouter.get("/:videoNodeId", (req, res) => {
  const row = getProgress(req.user!.id, Number(req.params.videoNodeId));
  res.json({ progress: row ?? null });
});

progressRouter.post("/", validateBody(updateProgressSchema), (req, res) => {
  const { videoNodeId, positionSeconds, completed } = req.body;
  upsertProgress(req.user!.id, videoNodeId, positionSeconds, completed);
  res.status(204).end();
});
