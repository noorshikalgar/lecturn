import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { coversDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export function coverPath(courseId: number): string {
  return join(coversDir, `${courseId}.jpg`);
}

/** Grabs a single frame partway into the video as a course cover thumbnail.
 * Seeking (`-ss`) before `-i` is a fast keyframe-ish seek — fine for a cover
 * image, not intended for frame-accurate extraction. */
export async function extractCoverFrame(absoluteVideoPath: string, courseId: number, durationSeconds: number): Promise<void> {
  const seekTo = durationSeconds > 4 ? Math.min(durationSeconds * 0.1, 120) : 0;
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(seekTo),
    "-i",
    absoluteVideoPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    coverPath(courseId),
  ]);
}
