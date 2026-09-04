import { existsSync, unlink } from "node:fs";
import { extname, join } from "node:path";
import { markCourseCompleteSchema } from "@lecturn/shared";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getCourseById, markCourseComplete } from "../db/repositories/coursesRepo.js";
import { deleteCertificate, getCertificateForCourse, upsertCertificate } from "../db/repositories/certificatesRepo.js";
import { certificatesDir } from "../media/paths.js";
import { canUserAccessCourse } from "../services/sectionVisibility.js";

export const certificatesRouter = Router();

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

// Guards every route below against an empty/missing :courseId — critically,
// this must run *before* multer on the upload route: multer's own
// destination/filename callbacks fire before our route handler ever runs,
// and they used to build the on-disk filename directly from the raw
// (unvalidated) param, so a value like "..%2F..%2Fcovers%2F3" could write
// outside certificatesDir entirely.
function requireCourseId(req: Request, _res: Response, next: NextFunction) {
  if (!(req.params.courseId as string)) {
    next(new ApiHttpError(400, "invalid_course_id", "courseId is required"));
    return;
  }
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: certificatesDir,
    filename: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${(req.params.courseId as string)}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new ApiHttpError(400, "invalid_file_type", "Certificate must be a PDF, JPG, or PNG"));
      return;
    }
    cb(null, true);
  },
});

certificatesRouter.get("/:courseId", requireCourseId, (req, res, next) => {
  const courseId = (req.params.courseId as string);
  if (!canUserAccessCourse(req.user!, courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  const cert = getCertificateForCourse(courseId);
  if (!cert) {
    next(new ApiHttpError(404, "not_found", "No certificate uploaded for this course"));
    return;
  }
  res.json({ certificate: cert });
});

certificatesRouter.get("/:courseId/file", requireCourseId, (req, res, next) => {
  const courseId = (req.params.courseId as string);
  if (!canUserAccessCourse(req.user!, courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  const cert = getCertificateForCourse(courseId);
  if (!cert || !existsSync(cert.filePath)) {
    next(new ApiHttpError(404, "not_found", "Certificate file not found"));
    return;
  }
  res.sendFile(cert.filePath);
});

// Certificate assets (the uploaded PDF/image) are an admin-curated resource,
// not something any signed-in user should be able to plant or remove.
certificatesRouter.post("/:courseId", requireCourseId, requireAdmin, upload.single("certificate"), (req, res, next) => {
  const courseId = (req.params.courseId as string);
  const existing = getCertificateForCourse(courseId);
  if (!getCourseById(courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  if (!req.file) {
    next(new ApiHttpError(400, "missing_file", "No certificate file uploaded"));
    return;
  }
  const cert = upsertCertificate(courseId, join(certificatesDir, req.file.filename));
  // The previous file (if any) is orphaned on disk the moment upsertCertificate
  // overwrites its DB row — clean it up now that the new one is safely stored.
  if (existing && existing.filePath !== cert.filePath && existsSync(existing.filePath)) {
    unlink(existing.filePath, () => {});
  }
  res.status(201).json({ certificate: cert });
});

certificatesRouter.delete("/:courseId", requireCourseId, requireAdmin, (req, res) => {
  const courseId = (req.params.courseId as string);
  const existing = getCertificateForCourse(courseId);
  deleteCertificate(courseId);
  if (existing && existsSync(existing.filePath)) {
    unlink(existing.filePath, () => {});
  }
  res.status(204).end();
});

// Left open to any user with course access, not admin-only — this is the
// natural "I just finished watching every video" trigger fired by the
// player itself (see CoursePage.tsx), not an admin action. The access check
// still stops someone from completing a course they can't even see.
certificatesRouter.patch(
  "/:courseId/complete",
  requireCourseId,
  validateBody(markCourseCompleteSchema),
  (req, res, next) => {
    const courseId = (req.params.courseId as string);
    if (!canUserAccessCourse(req.user!, courseId)) {
      next(new ApiHttpError(404, "not_found", "Course not found"));
      return;
    }
    markCourseComplete(courseId, req.body.completed);
    res.json({ course: getCourseById(courseId) });
  },
);
