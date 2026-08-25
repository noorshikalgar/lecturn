import { createReadStream, existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Router } from "express";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { getVideoMeta } from "../db/repositories/videoMetaRepo.js";
import { getSubtitleTrackById } from "../db/repositories/subtitleTracksRepo.js";
import { getCourseById } from "../db/repositories/coursesRepo.js";
import { resolveNodeAbsolutePath } from "../media/resolvePath.js";
import { ensureRemuxed } from "../media/remux.js";
import { coverPath } from "../media/cover.js";
import { subtitlesCacheDir } from "../media/paths.js";
import { srtToVtt } from "../media/srtToVtt.js";

export const streamRouter = Router();

const VIDEO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
};

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
  const absPath = coverPath(course.id);
  if (!existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "Cover image missing on disk"));
    return;
  }
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=86400");
  createReadStream(absPath).pipe(res);
});

streamRouter.get("/subtitles/:trackId", async (req, res, next) => {
  const track = getSubtitleTrackById(Number(req.params.trackId));
  const node = track && getNodeById(track.nodeId);
  if (!track || !node) {
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
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath || !existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "Video file missing on disk"));
    return;
  }

  try {
    const meta = getVideoMeta(node.id);
    let servePath = absPath;
    let mimeType = VIDEO_MIME[extname(absPath).toLowerCase()] ?? "video/mp4";
    if (meta?.needsRemux) {
      servePath = await ensureRemuxed(absPath, node.id);
      mimeType = "video/mp4";
    }

    const stats = await stat(servePath);
    const range = parseRange(req.headers.range, stats.size);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);

    if (range) {
      res.writeHead(206, {
        "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
        "Content-Length": range.end - range.start + 1,
      });
      createReadStream(servePath, { start: range.start, end: range.end }).pipe(res);
    } else {
      res.setHeader("Content-Length", stats.size);
      createReadStream(servePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});
