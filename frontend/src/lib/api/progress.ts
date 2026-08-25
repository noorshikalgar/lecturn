import type { Course, Progress } from "@coursedeck/shared";
import { api } from "../apiClient";

export function getProgress(videoNodeId: number) {
  return api.get<{ progress: Progress | null }>(`/progress/${videoNodeId}`);
}

export function postProgress(videoNodeId: number, positionSeconds: number, completed?: boolean) {
  return api.post<void>("/progress", { videoNodeId, positionSeconds, completed });
}

export function getContinueWatching() {
  return api.get<{ items: { progress: Progress; nodeTitle: string; course: Course }[] }>(
    "/progress/continue-watching",
  );
}

export function getCourseProgress(courseId: number) {
  return api.get<{ items: Progress[] }>(`/progress/course/${courseId}`);
}
