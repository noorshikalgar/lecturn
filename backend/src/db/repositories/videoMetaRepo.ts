import { eq, isNull, sql } from "drizzle-orm";
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
    .where(eq(nodes.courseId, courseId))
    .get();
  return Math.round(row?.total ?? 0);
}
