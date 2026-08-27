import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export class ApiHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiHttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation_error", message: err.issues.map((i) => i.message).join("; ") });
    return;
  }
  // req.log is pino-http's per-request child logger (see app.ts) — already
  // bound with this request's id/method/url, so a 500 in production can
  // actually be traced back to the request line that caused it instead of
  // just an isolated stack trace.
  (req.log ?? logger).error({ err }, "Unhandled error");
  res.status(500).json({ error: "internal_error", message: "Something went wrong" });
}

export function notFoundHandler(req: Request, res: Response) {
  req.log?.warn({ path: req.path, method: req.method }, "Route not found");
  res.status(404).json({ error: "not_found", message: "Route not found" });
}
