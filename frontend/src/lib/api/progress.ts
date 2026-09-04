import type { Course, Progress } from "@lecturn/shared";
import { api } from "../apiClient";

export function getProgress(videoNodeId: string) {
  return api.get<{ progress: Progress | null }>(`/progress/${videoNodeId}`);
}

export function postProgress(videoNodeId: string, positionSeconds: number, completed?: boolean) {
  return api.post<void>("/progress", { videoNodeId, positionSeconds, completed });
}

export function getContinueWatching() {
  return api.get<{ items: { progress: Progress; nodeTitle: string; course: Course }[] }>(
    "/progress/continue-watching",
  );
}

export function getCourseProgress(courseId: string) {
  return api.get<{ items: Progress[] }>(`/progress/course/${courseId}`);
}
