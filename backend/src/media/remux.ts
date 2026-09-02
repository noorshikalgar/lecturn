import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { remuxCacheDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export function remuxCachePath(nodeId: string): string {
  return join(remuxCacheDir, `${nodeId}.mp4`);
}

// Two requests for the same not-yet-cached video can arrive before either
// finishes remuxing; without this, both would spawn ffmpeg against the same
// temp file and race each other. Concurrent callers instead share one in-flight promise.
const inFlight = new Map<string, Promise<string>>();

async function runRemux(absoluteSourcePath: string, nodeId: string): Promise<string> {
  const target = remuxCachePath(nodeId);
  const tmpTarget = `${target}.partial.mp4`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    absoluteSourcePath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    tmpTarget,
  ]);
  await rename(tmpTarget, target);
  return target;
}

/** Fast container remux (no re-encode) for the rare video the browser can't
 * play directly (e.g. MKV) — swaps the container to MP4 while copying the
 * existing streams verbatim, then caches the result so this only runs once
 * per video. execFile with an argument array, not a shell, keeps this safe
 * even though the source path ultimately comes from a scanned filename. */
export async function ensureRemuxed(absoluteSourcePath: string, nodeId: string): Promise<string> {
  const target = remuxCachePath(nodeId);
  if (existsSync(target)) return target;

  const existing = inFlight.get(nodeId);
  if (existing) return existing;

  const promise = runRemux(absoluteSourcePath, nodeId).finally(() => inFlight.delete(nodeId));
  inFlight.set(nodeId, promise);
  return promise;
}
