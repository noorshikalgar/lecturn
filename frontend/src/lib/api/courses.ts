import type { Course, CourseTreeNode, Section } from "@lecturn/shared";
import { api } from "../apiClient";

export function getCourses() {
  return api.get<{ courses: Course[] }>("/courses");
}

export function getRecentCourses() {
  return api.get<{ courses: Course[] }>("/courses/recent");
}

export function getUnassignedCourses() {
  return api.get<{ courses: Course[] }>("/courses/unassigned");
}

export function searchCourses(query: string) {
  return api.get<{ courses: Course[] }>(`/courses/search?q=${encodeURIComponent(query)}`);
}

export function getCourse(id: number) {
  return api.get<{ course: Course; tree: CourseTreeNode[] }>(`/courses/${id}`);
}

export function getSections() {
  return api.get<{ sections: Section[] }>("/sections");
}

export function getSectionCourses(sectionId: number) {
  return api.get<{ courses: Course[] }>(`/sections/${sectionId}/courses`);
}
