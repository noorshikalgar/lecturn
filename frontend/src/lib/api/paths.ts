import type { Course, LearningPath } from "@lecturn/shared";
import { api } from "../apiClient";

export interface PathCourseEntry {
  course: Course;
  orderIndex: number;
}

export function getPaths() {
  return api.get<{ paths: LearningPath[] }>("/paths");
}

export function getPath(id: number) {
  return api.get<{ path: LearningPath; courses: PathCourseEntry[] }>(`/paths/${id}`);
}

export function createPath(title: string, description: string | null) {
  return api.post<{ path: LearningPath }>("/paths", { title, description });
}

export function reorderPaths(orderedPathIds: number[]) {
  return api.post<{ paths: LearningPath[] }>("/paths/reorder", { orderedPathIds });
}

export function addCourseToPath(pathId: number, courseId: number) {
  return api.post<{ courses: PathCourseEntry[] }>(`/paths/${pathId}/courses`, { courseId });
}

export function removeCourseFromPath(pathId: number, courseId: number) {
  return api.delete<void>(`/paths/${pathId}/courses/${courseId}`);
}

export function reorderPathCourses(pathId: number, orderedCourseIds: number[]) {
  return api.post<{ courses: PathCourseEntry[] }>(`/paths/${pathId}/reorder`, { orderedCourseIds });
}
