import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { subtitleTracks } from "../schema.js";

/** Subtitle tracks carry no user-editable state, so a rescan simply replaces
 * whatever was matched for this video node rather than diffing it. */
export function replaceSubtitleTracks(
  nodeId: string,
  tracks: { label: string; sourceFormat: "vtt" | "srt"; sourcePath: string }[],
) {
  db.delete(subtitleTracks).where(eq(subtitleTracks.nodeId, nodeId)).run();
  if (tracks.length === 0) return;
  db.insert(subtitleTracks)
    .values(tracks.map((t) => ({ nodeId, ...t })))
    .run();
}

export function listSubtitleTracks(nodeId: string) {
  return db.select().from(subtitleTracks).where(eq(subtitleTracks.nodeId, nodeId)).all();
}

export function getSubtitleTrackById(id: string) {
  return db.select().from(subtitleTracks).where(eq(subtitleTracks.id, id)).get();
}
