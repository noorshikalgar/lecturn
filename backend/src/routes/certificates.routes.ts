import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { markCourseCompleteSchema } from "@lecturn/shared";
import { Router } from "express";
import multer from "multer";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getCourseById, markCourseComplete } from "../db/repositories/coursesRepo.js";
import { deleteCertificate, getCertificateForCourse, upsertCertificate } from "../db/repositories/certificatesRepo.js";
import { certificatesDir } from "../media/paths.js";

export const certificatesRouter = Router();

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: certificatesDir,
    filename: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${req.params.courseId}-${Date.now()}${ext}`);
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

certificatesRouter.get("/:courseId", (req, res, next) => {
  const cert = getCertificateForCourse(Number(req.params.courseId));
  if (!cert) {
    next(new ApiHttpError(404, "not_found", "No certificate uploaded for this course"));
    return;
  }
  res.json({ certificate: cert });
});

certificatesRouter.get("/:courseId/file", (req, res, next) => {
  const cert = getCertificateForCourse(Number(req.params.courseId));
  if (!cert || !existsSync(cert.filePath)) {
    next(new ApiHttpError(404, "not_found", "Certificate file not found"));
    return;
  }
  res.sendFile(cert.filePath);
});

certificatesRouter.post("/:courseId", upload.single("certificate"), (req, res, next) => {
  if (!getCourseById(Number(req.params.courseId))) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  if (!req.file) {
    next(new ApiHttpError(400, "missing_file", "No certificate file uploaded"));
    return;
  }
  const cert = upsertCertificate(Number(req.params.courseId), join(certificatesDir, req.file.filename));
  res.status(201).json({ certificate: cert });
});

certificatesRouter.delete("/:courseId", (req, res) => {
  deleteCertificate(Number(req.params.courseId));
  res.status(204).end();
});

certificatesRouter.patch("/:courseId/complete", validateBody(markCourseCompleteSchema), (req, res, next) => {
  const courseId = Number(req.params.courseId);
  if (!getCourseById(courseId)) {
    next(new ApiHttpError(404, "not_found", "Course not found"));
    return;
  }
  markCourseComplete(courseId, req.body.completed);
  res.json({ course: getCourseById(courseId) });
});
