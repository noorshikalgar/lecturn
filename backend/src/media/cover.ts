import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { coversDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export function coverPath(courseId: string): string {
  return join(coversDir, `${courseId}.jpg`);
}

// Serving a cover must resolve through the filename actually stored on the
// course row, not reconstruct one from the course's current id — a course's
// id can change under a migration (see the UUID primary-key migration) while
// the cover file on disk keeps whatever name it was extracted under, and
// coverImagePath is exactly the column that survives that unchanged.
export function coverAbsolutePath(coverImagePath: string): string {
  return join(coversDir, coverImagePath);
}

/** Grabs a single frame partway into the video as a course cover thumbnail.
 * Seeking (`-ss`) before `-i` is a fast keyframe-ish seek — fine for a cover
 * image, not intended for frame-accurate extraction. */
export async function extractCoverFrame(absoluteVideoPath: string, courseId: string, durationSeconds: number): Promise<void> {
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
