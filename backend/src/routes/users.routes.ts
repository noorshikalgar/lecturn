import { changeUsernameSchema, createUserSchema, updateProfileSchema } from "@lecturn/shared";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { logActivity } from "../db/repositories/activityLogRepo.js";
import { getUserActivitySummary } from "../services/userActivityService.js";
import {
  changeUsername,
  createUser,
  deleteUser,
  getUsername,
  listAllUsers,
  resetPassword,
  updateProfile,
  updateUserRole,
} from "../services/authService.js";

export const usersRouter = Router();

usersRouter.use(requireAdmin);

usersRouter.get("/", (_req, res) => {
  res.json({ users: listAllUsers() });
});

usersRouter.post("/", validateBody(createUserSchema), (req, res) => {
  const { username, password, role, firstName, lastName, email, avatarId } = req.body;
  const user = createUser(username, password, role, { firstName, lastName, email, avatarId });
  logActivity({
    type: "user_created",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId: user.id,
    message: `${req.user!.username} created user "${username}" (${role})`,
  });
  res.status(201).json({ user });
});

// Admin has full rights over any user's profile fields — username and role
// changes go through their own dedicated routes below, not this one.
usersRouter.patch("/:id", validateBody(updateProfileSchema), (req, res) => {
  const user = updateProfile((req.params.id as string), req.body);
  logActivity({
    type: "user_profile_edited",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId: user.id,
    message: `${req.user!.username} edited ${user.username}'s profile`,
  });
  res.json({ user });
});

usersRouter.patch("/:id/username", validateBody(changeUsernameSchema), (req, res) => {
  const targetId = req.params.id as string;
  const oldUsername = getUsername(targetId);
  const user = changeUsername(targetId, req.body.username);
  logActivity({
    type: "user_username_changed",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId,
    message: `${req.user!.username} changed ${oldUsername ?? "a user"}'s username to "${user.username}"`,
  });
  res.json({ user });
});

const roleSchema = z.object({ role: z.enum(["admin", "user"]) });

usersRouter.patch("/:id/role", validateBody(roleSchema), (req, res) => {
  const user = updateUserRole((req.params.id as string), req.body.role);
  logActivity({
    type: "user_role_changed",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId: user.id,
    message: `${req.user!.username} changed ${user.username}'s role to ${user.role}`,
  });
  res.json({ user });
});

const passwordSchema = z.object({ password: z.string().min(8) });

usersRouter.patch("/:id/password", validateBody(passwordSchema), (req, res) => {
  const targetId = req.params.id as string;
  const targetUsername = getUsername(targetId);
  resetPassword(targetId, req.body.password);
  logActivity({
    type: "user_password_reset",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId,
    message: `${req.user!.username} reset ${targetUsername ?? "a user"}'s password`,
  });
  res.status(204).end();
});

usersRouter.get("/:id/activity", (req, res, next) => {
  const targetId = req.params.id as string;
  if (!getUsername(targetId)) {
    next(new ApiHttpError(404, "not_found", "User not found"));
    return;
  }
  res.json(getUserActivitySummary(targetId));
});

usersRouter.delete("/:id", (req, res) => {
  const targetId = req.params.id as string;
  const targetUsername = getUsername(targetId);
  deleteUser(targetId, req.user!.id);
  logActivity({
    type: "user_deleted",
    actorUserId: req.user!.id,
    targetType: "user",
    targetId,
    message: `${req.user!.username} deleted user "${targetUsername ?? targetId}"`,
  });
  res.status(204).end();
});
