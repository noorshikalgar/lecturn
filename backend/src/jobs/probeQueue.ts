import { probeVideo } from "../media/ffprobe.js";
import { extractCoverFrame } from "../media/cover.js";
import { resolveNodeAbsolutePath } from "../media/resolvePath.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { getCourseById, setCourseCoverPath, setCourseDuration } from "../db/repositories/coursesRepo.js";
import { listUnprobedVideoNodeIds, setVideoProbe, sumProbedDurationForCourse } from "../db/repositories/videoMetaRepo.js";
import { logger } from "../utils/logger.js";

const CONCURRENCY = 2;
let queue: string[] = [];
let running = false;

async function processNode(nodeId: string): Promise<void> {
  const node = getNodeById(nodeId);
  if (!node || node.type !== "video") return;
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath) return;

  try {
    const probe = await probeVideo(absPath);
    setVideoProbe(nodeId, {
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      codec: probe.codec,
      container: probe.container,
    });

    const course = getCourseById(node.courseId);
    if (course) {
      setCourseDuration(course.id, sumProbedDurationForCourse(course.id));
      if (!course.coverImagePath && probe.durationSeconds > 0) {
        try {
          await extractCoverFrame(absPath, course.id, probe.durationSeconds);
          setCourseCoverPath(course.id, `${course.id}.jpg`);
        } catch (err) {
          logger.warn({ err, courseId: course.id }, "Cover frame extraction failed");
        }
      }
    }
  } catch (err) {
    logger.warn({ err, nodeId, absPath }, "ffprobe failed for video node");
  }
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      // processNode already swallows the failures we expect (bad probe, missing
      // file); catch here too so one truly unexpected throw (e.g. a DB error)
      // can't leave `running` stuck true and wedge the queue forever.
      const results = await Promise.allSettled(batch.map(processNode));
      for (const result of results) {
        if (result.status === "rejected") {
          logger.error({ err: result.reason }, "Unexpected error draining probe queue");
        }
      }
    }
  } finally {
    running = false;
  }
}

export function enqueueProbe(nodeIds: string[]): void {
  queue.push(...nodeIds);
  void drain();
}

export function enqueueAllUnprobed(): void {
  enqueueProbe(listUnprobedVideoNodeIds());
}
