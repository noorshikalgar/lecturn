import { extname } from "node:path";
import { fileStem } from "./classify.js";

export interface SubtitleMatch {
  fileName: string;
  label: string;
  format: "vtt" | "srt";
}

export interface SubtitleMatchResult {
  /** video file name -> subtitle tracks matched to it */
  assignments: Map<string, SubtitleMatch[]>;
  /** subtitle file names that matched no video (kept as orphan resources) */
  unmatched: Set<string>;
}

function cleanLabel(remainder: string): string {
  const cleaned = remainder.replace(/^[\s._\-()]+|[\s._\-()]+$/g, "");
  if (!cleaned) return "English";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Matches subtitle files to sibling video files in the same directory by
 * filename-stem prefix — "Lecture 01.mp4" pairs with "Lecture 01.vtt" and
 * "Lecture 01.en.vtt"/"Lecture 01 (Spanish).srt" alike, picking the video
 * whose stem is the longest matching prefix when several could apply. */
export function matchSubtitles(videoNames: string[], subtitleNames: string[]): SubtitleMatchResult {
  const videoStems = videoNames.map((name) => ({ name, stem: fileStem(name) }));
  const assignments = new Map<string, SubtitleMatch[]>();
  const unmatched = new Set<string>();

  for (const subName of subtitleNames) {
    const subStem = fileStem(subName);
    let best: { name: string; stem: string } | undefined;
    for (const candidate of videoStems) {
      if (subStem === candidate.stem || subStem.startsWith(candidate.stem)) {
        if (!best || candidate.stem.length > best.stem.length) best = candidate;
      }
    }
    if (!best) {
      unmatched.add(subName);
      continue;
    }
    const label = cleanLabel(subStem.slice(best.stem.length));
    const format = extname(subName).slice(1).toLowerCase() as "vtt" | "srt";
    const list = assignments.get(best.name) ?? [];
    list.push({ fileName: subName, label, format });
    assignments.set(best.name, list);
  }

  return { assignments, unmatched };
}
