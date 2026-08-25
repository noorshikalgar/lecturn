import { extname } from "node:path";

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "m4v"]);
const SUBTITLE_EXTENSIONS = new Set(["vtt", "srt"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "7z"]);

function ext(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

export function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.has(ext(name));
}

/** MKV's container isn't supported by browser <video> elements regardless of
 * the codec inside it, so it needs a one-time remux to MP4 before streaming. */
export function needsRemuxForBrowser(name: string): boolean {
  return ext(name) === "mkv";
}

export function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXTENSIONS.has(ext(name));
}

export function isArchiveFile(name: string): boolean {
  return ARCHIVE_EXTENSIONS.has(ext(name));
}

export function isNfoFile(name: string): boolean {
  return ext(name) === "nfo";
}

export function isUrlShortcutFile(name: string): boolean {
  return ext(name) === "url";
}

/** Anything not video/subtitle/archive/nfo/url is a generic downloadable resource. */
export function isResourceFile(name: string): boolean {
  return (
    !isVideoFile(name) &&
    !isSubtitleFile(name) &&
    !isArchiveFile(name) &&
    !isNfoFile(name) &&
    !isUrlShortcutFile(name)
  );
}

export function fileStem(name: string): string {
  const e = extname(name);
  return e ? name.slice(0, -e.length) : name;
}
