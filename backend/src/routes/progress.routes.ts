import { updateProgressSchema } from "@lecturn/shared";
import { Router } from "express";
import { validateBody } from "../middleware/validateBody.js";
import { getProgress, listContinueWatching, listProgressForCourse, upsertProgress } from "../db/repositories/progressRepo.js";

export const progressRouter = Router();

progressRouter.get("/continue-watching", (req, res) => {
  res.json({ items: listContinueWatching(req.user!.id) });
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
