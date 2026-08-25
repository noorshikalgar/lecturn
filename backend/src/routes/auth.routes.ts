import { loginSchema } from "@coursedeck/shared";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { login, logout, SESSION_COOKIE_NAME } from "../services/authService.js";
import { env } from "../config/env.js";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

authRouter.post("/login", validateBody(loginSchema), (req, res) => {
  const { username, password } = req.body;
  const { token, user } = login(username, password);
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
  res.json({ user });
});

authRouter.post("/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) logout(token);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
