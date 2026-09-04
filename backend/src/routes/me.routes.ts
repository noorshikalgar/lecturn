import { changeOwnPasswordSchema, updateProfileSchema } from "@lecturn/shared";
import { Router } from "express";
import { validateBody } from "../middleware/validateBody.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";
import { changeOwnPassword, updateProfile } from "../services/authService.js";

// Self-service profile routes — deliberately separate from users.routes.ts,
// which is entirely requireAdmin-gated (see its `usersRouter.use(requireAdmin)`).
// Mounted under apiRouter's blanket requireAuth in routes/index.ts, so any
// signed-in user reaches these for their own account.
export const meRouter = Router();

meRouter.patch("/", validateBody(updateProfileSchema), (req, res) => {
  const user = updateProfile(req.user!.id, req.body);
  logActivity({
    type: "user_profile_edited",
    actorUserId: user.id,
    targetType: "user",
    targetId: user.id,
    message: `${user.username} edited their own profile`,
  });
  res.json({ user });
});

meRouter.patch("/password", validateBody(changeOwnPasswordSchema), (req, res) => {
  changeOwnPassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.status(204).end();
});
