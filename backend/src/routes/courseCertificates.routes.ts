import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { canUserAccessCourse } from "../services/sectionVisibility.js";
import { getOrIssueCertificate } from "../services/certificateService.js";

export const courseCertificatesRouter = Router();

function requireCourseId(req: Request, _res: Response, next: NextFunction) {
  if (!(req.params.courseId as string)) {
    next(new ApiHttpError(400, "invalid_course_id", "courseId is required"));
    return;
  }
  next();
}

// Get-or-create, not a separate POST — the frontend just wants "my
// certificate for this course", and issuing it lazily on first request
// matches how the ungraded predecessor of this feature already worked
// (generated on the spot when the learner asks to see it), just persisted
// and signed now instead of ephemeral.
courseCertificatesRouter.get("/:courseId/mine", requireCourseId, (req, res, next) => {
  const courseId = (req.params.courseId as string);
  if (!canUserAccessCourse(req.user!, courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  try {
    res.json({ certificate: getOrIssueCertificate(req.user!.id, courseId) });
  } catch (err) {
    next(err);
  }
});
