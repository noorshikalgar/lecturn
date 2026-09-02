import { createUserSchema } from "@lecturn/shared";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { createUser, deleteUser, listAllUsers, resetPassword, updateUserRole } from "../services/authService.js";

export const usersRouter = Router();

usersRouter.use(requireAdmin);

usersRouter.get("/", (_req, res) => {
  res.json({ users: listAllUsers() });
});

usersRouter.post("/", validateBody(createUserSchema), (req, res) => {
  const { username, password, role } = req.body;
  res.status(201).json({ user: createUser(username, password, role) });
});

const roleSchema = z.object({ role: z.enum(["admin", "user"]) });

usersRouter.patch("/:id/role", validateBody(roleSchema), (req, res) => {
  const user = updateUserRole((req.params.id as string), req.body.role);
  res.json({ user });
});

const passwordSchema = z.object({ password: z.string().min(8) });

usersRouter.patch("/:id/password", validateBody(passwordSchema), (req, res) => {
  resetPassword((req.params.id as string), req.body.password);
  res.status(204).end();
});

usersRouter.delete("/:id", (req, res) => {
  deleteUser((req.params.id as string), req.user!.id);
  res.status(204).end();
});
