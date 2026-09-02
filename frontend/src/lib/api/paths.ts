import type { Course, LearningPath } from "@lecturn/shared";
import { api } from "../apiClient";

export interface PathCourseEntry {
  course: Course;
  orderIndex: number;
}

export function getPaths() {
  return api.get<{ paths: LearningPath[] }>("/paths");
}

export function getPath(id: string) {
  return api.get<{ path: LearningPath; courses: PathCourseEntry[] }>(`/paths/${id}`);
}

export function createPath(title: string, description: string | null) {
  return api.post<{ path: LearningPath }>("/paths", { title, description });
}

export function reorderPaths(orderedPathIds: string[]) {
  return api.post<{ paths: LearningPath[] }>("/paths/reorder", { orderedPathIds });
}

export function addCourseToPath(pathId: string, courseId: string) {
  return api.post<{ courses: PathCourseEntry[] }>(`/paths/${pathId}/courses`, { courseId });
}

export function removeCourseFromPath(pathId: string, courseId: string) {
  return api.delete<void>(`/paths/${pathId}/courses/${courseId}`);
}

export function reorderPathCourses(pathId: string, orderedCourseIds: string[]) {
  return api.post<{ courses: PathCourseEntry[] }>(`/paths/${pathId}/reorder`, { orderedCourseIds });
}
