import { createReadStream, existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextFunction, Response } from "express";
import { Router } from "express";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { getSubtitleTrackById } from "../db/repositories/subtitleTracksRepo.js";
import { getCourseById } from "../db/repositories/coursesRepo.js";
import { resolveNodeAbsolutePath } from "../media/resolvePath.js";
import { ensureRemuxed } from "../media/remux.js";
import { coverPath } from "../media/cover.js";
import { subtitlesCacheDir } from "../media/paths.js";
import { srtToVtt } from "../media/srtToVtt.js";
import { canUserAccessCourse, canUserAccessNode } from "../services/sectionVisibility.js";

export const streamRouter = Router();

// A read-stream's own 'error' event (the file vanishing mid-read, an I/O
// failure) is neither a synchronous throw nor a rejected awaited promise,
// so Express 4's async-handler support does nothing for it — left
// unhandled it's an uncaught exception. If we haven't written anything to
// the response yet, hand it to the normal error handler for a proper JSON
// error; if bytes are already flowing, the client already has a partial
// response and the only sane move is to end the connection.
function handleStreamError(err: unknown, res: Response, next: NextFunction) {
  if (res.headersSent) {
    logger.error({ err }, "Stream error after headers sent — ending response");
    res.destroy();
    return;
  }
  next(err);
}

function parseRange(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader?.startsWith("bytes=")) return null;
  const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
  const start = startStr ? parseInt(startStr, 10) : 0;
  const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) return null;
  return { start, end };
}

streamRouter.get("/cover/:courseId", async (req, res, next) => {
  const course = getCourseById(Number(req.params.courseId));
  if (!course?.coverImagePath) {
    next(new ApiHttpError(404, "not_found", "No cover image"));
    return;
  }
  if (!canUserAccessCourse(req.user!, course.id)) {
    next(new ApiHttpError(404, "not_found", "No cover image"));
    return;
  }
  const absPath = coverPath(course.id);
  if (!existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "Cover image missing on disk"));
    return;
  }
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=86400");
  createReadStream(absPath)
    .on("error", (err) => handleStreamError(err, res, next))
    .pipe(res);
});

streamRouter.get("/subtitles/:trackId", async (req, res, next) => {
  const track = getSubtitleTrackById(Number(req.params.trackId));
  const node = track && getNodeById(track.nodeId);
  if (!track || !node) {
    next(new ApiHttpError(404, "not_found", "Subtitle track not found"));
    return;
  }
  if (!canUserAccessNode(req.user!, node.id)) {
    next(new ApiHttpError(404, "not_found", "Subtitle track not found"));
    return;
  }

  try {
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");

    if (track.sourceFormat === "vtt") {
      const absPath = resolveNodeAbsolutePath(node.courseId, track.sourcePath);
      if (!absPath || !existsSync(absPath)) {
        next(new ApiHttpError(404, "not_found", "Subtitle file missing on disk"));
        return;
      }
      res.send(await readFile(absPath, "utf-8"));
      return;
    }

    const cachedPath = join(subtitlesCacheDir, `${track.id}.vtt`);
    if (existsSync(cachedPath)) {
      res.send(await readFile(cachedPath, "utf-8"));
      return;
    }

    const absPath = resolveNodeAbsolutePath(node.courseId, track.sourcePath);
    if (!absPath || !existsSync(absPath)) {
      next(new ApiHttpError(404, "not_found", "Subtitle file missing on disk"));
      return;
    }
    const vtt = srtToVtt(await readFile(absPath, "utf-8"));
    await writeFile(cachedPath, vtt, "utf-8");
    res.send(vtt);
  } catch (err) {
    next(err);
  }
});

// Registered last: the two routes above have static prefixes ("cover/",
// "subtitles/") that would otherwise be swallowed by this catch-all :nodeId param.
streamRouter.get("/:nodeId", async (req, res, next) => {
  const node = getNodeById(Number(req.params.nodeId));
  if (!node || node.type !== "video") {
    next(new ApiHttpError(404, "not_found", "Video not found"));
    return;
  }
  if (!canUserAccessNode(req.user!, node.id)) {
    next(new ApiHttpError(404, "not_found", "Video not found"));
    return;
  }
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath || !existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "Video file missing on disk"));
    return;
  }

  try {
    // Every video gets the same cheap, cached, stream-copy remux pass — not
    // just containers the browser can't play at all (.mkv). A regular .mp4
    // downloaded from anywhere is just as likely to have its moov atom at
    // the end of the file rather than the front ("faststart"), and browsers
    // can only reliably learn the file's true duration by reading that atom.
    // Serve one of those directly over Range requests and the browser has to
    // guess a duration before it's fetched the atom — sometimes it guesses
    // wildly short (seen in practice: 1 second for a multi-minute video),
    // and once playback reaches that wrong number it fires a fully genuine,
    // spec-correct "ended" event — which is indistinguishable from the video
    // actually finishing, and which cascades autoplay through the entire
    // rest of the course in seconds. ensureRemuxed's own on-disk cache check
    // means this is a one-time cost per video, identical in effect to the
    // .mkv path, just triggered unconditionally instead of gated on the
    // needsRemux flag captured once at probe time.
    const servePath = await ensureRemuxed(absPath, node.id);
    const mimeType = "video/mp4";

    const stats = await stat(servePath);
    const range = parseRange(req.headers.range, stats.size);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);

    if (range) {
      res.writeHead(206, {
        "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
        "Content-Length": range.end - range.start + 1,
      });
      createReadStream(servePath, { start: range.start, end: range.end })
        .on("error", (err) => handleStreamError(err, res, next))
        .pipe(res);
    } else {
      res.setHeader("Content-Length", stats.size);
      createReadStream(servePath)
        .on("error", (err) => handleStreamError(err, res, next))
        .pipe(res);
    }
  } catch (err) {
    next(err);
  }
});
