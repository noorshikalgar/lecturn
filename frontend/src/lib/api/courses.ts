import type { Collection, Course, CourseTreeNode, SearchNodeMatch, SearchNoteMatch, Section } from "@lecturn/shared";
import { api } from "../apiClient";

export function getCourses() {
  return api.get<{ courses: Course[] }>("/courses");
}

export function getRecentCourses() {
  return api.get<{ courses: Course[]; collections: Collection[] }>("/courses/recent");
}

export function getUnassignedCourses() {
  return api.get<{ courses: Course[]; collections: Collection[] }>("/courses/unassigned");
}

export function searchCourses(query: string) {
  return api.get<{ courses: Course[]; collections: Collection[]; nodes: SearchNodeMatch[]; notes: SearchNoteMatch[] }>(
    `/courses/search?q=${encodeURIComponent(query)}`,
  );
}

export function getCourse(id: string) {
  return api.get<{ course: Course; tree: CourseTreeNode[] }>(`/courses/${id}`);
}

export function getSections() {
  return api.get<{ sections: Section[] }>("/sections");
}

export function getSectionCourses(sectionId: string) {
  return api.get<{ courses: Course[]; collections: Collection[] }>(`/sections/${sectionId}/courses`);
}

export function getCollection(id: string) {
  return api.get<{ collection: Collection }>(`/collections/${id}`);
}
