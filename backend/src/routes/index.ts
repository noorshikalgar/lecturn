import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { activityRouter } from "./activity.routes.js";
import { authRouter } from "./auth.routes.js";
import { certificatesRouter } from "./certificates.routes.js";
import { courseCertificatesRouter } from "./courseCertificates.routes.js";
import { coursesRouter } from "./courses.routes.js";
import { librariesRouter } from "./libraries.routes.js";
import { meRouter } from "./me.routes.js";
import { nodesRouter } from "./nodes.routes.js";
import { notesRouter } from "./notes.routes.js";
import { pathsRouter } from "./paths.routes.js";
import { progressRouter } from "./progress.routes.js";
import { sectionsRouter } from "./sections.routes.js";
import { streamRouter } from "./stream.routes.js";
import { usersRouter } from "./users.routes.js";
import { verifyRouter } from "./verify.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.use("/auth", authRouter);
// Public on purpose — see verify.routes.ts's own comment.
apiRouter.use("/verify", verifyRouter);

apiRouter.use(requireAuth);

apiRouter.use("/me", meRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/libraries", librariesRouter);
apiRouter.use("/sections", sectionsRouter);
apiRouter.use("/courses", coursesRouter);
apiRouter.use("/nodes", nodesRouter);
apiRouter.use("/progress", progressRouter);
apiRouter.use("/stream", streamRouter);
apiRouter.use("/notes", notesRouter);
apiRouter.use("/certificates", certificatesRouter);
apiRouter.use("/course-certificates", courseCertificatesRouter);
apiRouter.use("/paths", pathsRouter);
