import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client.js";
import { nodes, videoMeta } from "../schema.js";

export function ensureVideoMetaRow(nodeId: number) {
  const existing = db.select().from(videoMeta).where(eq(videoMeta.nodeId, nodeId)).get();
  if (existing) return existing;
  return db.insert(videoMeta).values({ nodeId }).returning().get();
}

export function getVideoMeta(nodeId: number) {
  return db.select().from(videoMeta).where(eq(videoMeta.nodeId, nodeId)).get();
}

export function setVideoProbe(
  nodeId: number,
  probe: { durationSeconds: number; width: number; height: number; codec: string; container: string; needsRemux: boolean },
) {
  db.update(videoMeta)
    .set({ ...probe, probedAt: new Date().toISOString() })
    .where(eq(videoMeta.nodeId, nodeId))
    .run();
}

/** Clears a node's probe results so it's picked up by the next
 * enqueueAllUnprobed() pass — used when a rescan finds the file at a node's
 * path has actually changed content (different fingerprint), so the old
 * duration/codec/dimensions no longer describe what's really there. Leaves
 * the stale numbers in place until the re-probe completes rather than
 * nulling them out too: probedAt is the only column anything actually
 * gates on (listUnprobedVideoNodeIds below), and a briefly-stale duration
 * is a smaller problem than a course's total duration or player UI
 * flickering to zero for the few seconds until ffprobe finishes. */
export function resetVideoProbe(nodeId: number) {
  db.update(videoMeta).set({ probedAt: null }).where(eq(videoMeta.nodeId, nodeId)).run();
}

export function listUnprobedVideoNodeIds(): number[] {
  return db
    .select({ nodeId: videoMeta.nodeId })
    .from(videoMeta)
    .where(isNull(videoMeta.probedAt))
    .all()
    .map((r) => r.nodeId);
}

export function sumProbedDurationForCourse(courseId: number): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${videoMeta.durationSeconds}), 0)` })
    .from(videoMeta)
    .innerJoin(nodes, eq(nodes.id, videoMeta.nodeId))
    // Excludes videos a rescan has flagged missing — otherwise a course's
    // total duration keeps counting files that no longer exist on disk,
    // permanently drifting upward every time something is removed.
    .where(and(eq(nodes.courseId, courseId), eq(nodes.missing, false)))
    .get();
  return Math.round(row?.total ?? 0);
}
