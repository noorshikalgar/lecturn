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

// Redistribution-site self-promo (.url shortcuts) and OS-generated clutter
// (Windows thumbnail/folder-settings caches) — never worth surfacing as
// course content, so the scanner skips them outright rather than treating
// them as a generic resource.
const JUNK_FILENAMES = new Set(["thumbs.db", "desktop.ini", "ehthumbs.db"]);

export function isJunkFile(name: string): boolean {
  return isUrlShortcutFile(name) || JUNK_FILENAMES.has(name.toLowerCase());
}

/** Anything not video/subtitle/archive/nfo/junk is a generic downloadable resource. */
export function isResourceFile(name: string): boolean {
  return !isVideoFile(name) && !isSubtitleFile(name) && !isArchiveFile(name) && !isNfoFile(name) && !isJunkFile(name);
}

export function fileStem(name: string): string {
  const e = extname(name);
  return e ? name.slice(0, -e.length) : name;
}
