import { Router } from "express";
import { listLibraries } from "../db/repositories/librariesRepo.js";
import { listSections } from "../db/repositories/sectionsRepo.js";
import { listCoursesBySection } from "../db/repositories/coursesRepo.js";

export const sectionsRouter = Router();

sectionsRouter.get("/", (_req, res) => {
  const sections = listLibraries().flatMap((lib) => listSections(lib.id));
  res.json({ sections });
});

sectionsRouter.get("/:id/courses", (req, res) => {
  res.json({ courses: listCoursesBySection(Number(req.params.id)) });
});
