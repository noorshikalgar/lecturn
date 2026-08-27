import type { NextFunction, Request, Response } from "express";
import { touchSession } from "../db/repositories/sessionsRepo.js";
import { getUserForToken, SESSION_COOKIE_NAME } from "../services/authService.js";
import { ApiHttpError } from "./errorHandler.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const user = token ? getUserForToken(token) : undefined;
  if (!user) {
    next(new ApiHttpError(401, "unauthenticated", "Please sign in"));
    return;
  }
  req.user = user;
  touchSession(token!);
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    next(new ApiHttpError(403, "forbidden", "Admin access required"));
    return;
  }
  next();
}
