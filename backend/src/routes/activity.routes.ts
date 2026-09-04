import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listActivity, type ActivityType } from "../db/repositories/activityLogRepo.js";

export const activityRouter = Router();

activityRouter.use(requireAdmin);

activityRouter.get("/", (req, res) => {
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const type = typeof req.query.type === "string" ? (req.query.type as ActivityType) : undefined;
  const actorUserId = typeof req.query.actorUserId === "string" ? req.query.actorUserId : undefined;
  res.json(listActivity({ cursor, type, actorUserId }));
});
