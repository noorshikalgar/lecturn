import type { BrowseResult, Course, ExploreResult, Library, ScanSummary, Section, User } from "@lecturn/shared";
import { api } from "../apiClient";

export interface MissingEntry {
  node: { id: number; title: string; relativePath: string };
  course: { id: number; title: string };
}

export function getLibraries() {
  return api.get<{ libraries: Library[] }>("/libraries");
}

export function createLibrary(rootPath: string) {
  return api.post<{ library: Library }>("/libraries", { rootPath });
}

export function browseDirectory(path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  return api.get<BrowseResult>(`/libraries/browse${query}`);
}

export function deleteLibrary(id: number) {
  return api.delete<void>(`/libraries/${id}`);
}

export function scanLibrary(id: number) {
  return api.post<{ summary: ScanSummary }>(`/libraries/${id}/scan`);
}

export function getMissingFiles(libraryId: number) {
  return api.get<{ missing: MissingEntry[] }>(`/libraries/${libraryId}/missing`);
}

export function exploreLibrary(libraryId: number, path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  return api.get<ExploreResult>(`/libraries/${libraryId}/explore${query}`);
}

export function markCourseFolder(libraryId: number, folderPath: string) {
  return api.post<{ ok: true }>(`/libraries/${libraryId}/mark-course`, { folderPath });
}

export function getUsers() {
  return api.get<{ users: User[] }>("/users");
}

export function createUser(username: string, password: string, role: "admin" | "user") {
  return api.post<{ user: User }>("/users", { username, password, role });
}

export function updateUserRole(id: number, role: "admin" | "user") {
  return api.patch<{ user: User }>(`/users/${id}/role`, { role });
}

export function resetUserPassword(id: number, password: string) {
  return api.patch<void>(`/users/${id}/password`, { password });
}

export function deleteUser(id: number) {
  return api.delete<void>(`/users/${id}`);
}

export function createSection(title: string) {
  return api.post<{ section: Section }>("/sections", { title });
}

export function deleteSection(id: number) {
  return api.delete<void>(`/sections/${id}`);
}

export function getSectionAccess(id: number) {
  return api.get<{ userIds: number[] }>(`/sections/${id}/access`);
}

export function setSectionAccess(id: number, userIds: number[]) {
  return api.put<{ userIds: number[] }>(`/sections/${id}/access`, { userIds });
}

export function setSectionHidden(id: number, hidden: boolean) {
  return api.patch<{ section: Section }>(`/sections/${id}/hidden`, { hidden });
}

export function assignCourseSection(courseId: number, sectionId: number | null) {
  return api.patch<{ course: Course }>(`/courses/${courseId}/section`, { sectionId });
}

export function deleteCourse(id: number) {
  return api.delete<void>(`/courses/${id}`);
}

export function setCourseHidden(id: number, hidden: boolean) {
  return api.patch<{ course: Course }>(`/courses/${id}/hidden`, { hidden });
}
