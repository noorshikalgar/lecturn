import { loginSchema } from "@lecturn/shared";
import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { login, logout, SESSION_COOKIE_NAME } from "../services/authService.js";
import { env } from "../config/env.js";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

// Scrypt is deliberately slow, but that only helps against an *offline*
// attacker who has stolen the hash — with no throttle at all, an *online*
// brute-force against this endpoint was limited only by network speed.
// Keyed on IP + the attempted username so one person mistyping their own
// password repeatedly doesn't get every other account on the same NAT/VPN
// locked out alongside them.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${typeof req.body?.username === "string" ? req.body.username.toLowerCase() : ""}`,
  message: { error: "too_many_attempts", message: "Too many sign-in attempts. Try again in a few minutes." },
});

authRouter.post("/login", loginRateLimit, validateBody(loginSchema), (req, res) => {
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
