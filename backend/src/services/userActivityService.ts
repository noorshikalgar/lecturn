import { listCourses } from "../db/repositories/coursesRepo.js";
import { getTotalWatchSeconds, listContinueWatching } from "../db/repositories/progressRepo.js";
import { getCurrentStreak } from "../db/repositories/dailyActivityRepo.js";
import { listSessionHistoryForUser } from "../db/repositories/sessionsRepo.js";

export function getUserActivitySummary(userId: string) {
  const courses = listCourses(userId);
  const coursesCompleted = courses.filter((c) => c.completedByUser).length;
  // listContinueWatching already returns exactly "courses with unfinished
  // progress," one row per course, most-recent-first — reusing it here
  // instead of re-deriving the same "has progress but not done" logic.
  const inProgress = listContinueWatching(userId, 10_000);
  const coursesInProgress = inProgress.length;
  const currentlyWatching = inProgress[0];

  const sessions = listSessionHistoryForUser(userId).map((s) => ({
    token: s.token.slice(0, 8), // never expose the real session token
    createdAt: s.createdAt,
    endedAt: s.endedAt,
    lastSeenAt: s.lastSeenAt,
  }));

  return {
    coursesCompleted,
    coursesInProgress,
    totalWatchSeconds: getTotalWatchSeconds(userId),
    currentStreak: getCurrentStreak(userId),
    currentlyWatching: currentlyWatching
      ? { courseId: currentlyWatching.course.id, courseTitle: currentlyWatching.course.title, videoTitle: currentlyWatching.nodeTitle }
      : null,
    sessions,
  };
}
