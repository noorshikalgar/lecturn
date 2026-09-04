import type { BrowseResult, Course, ExploreResult, Library, Section, User, UserActivitySummary } from "@lecturn/shared";
import { api } from "../apiClient";

export interface MissingEntry {
  node: { id: string; title: string; relativePath: string };
  course: { id: string; title: string };
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

export function deleteLibrary(id: string) {
  return api.delete<{ affectedCourses: number }>(`/libraries/${id}`);
}

// Kicks the scan off and returns immediately — it runs detached on the
// server. Poll the library row itself (scanStatus/lastScanSummary/scanError)
// for progress and the result; see LibrariesPage.
export function scanLibrary(id: string) {
  return api.post<{ status: "running" }>(`/libraries/${id}/scan`);
}

export function getMissingFiles(libraryId: string) {
  return api.get<{ missing: MissingEntry[] }>(`/libraries/${libraryId}/missing`);
}

export function getOrphanedCourses(libraryId: string) {
  return api.get<{ orphaned: Course[] }>(`/libraries/${libraryId}/orphaned`);
}

export function relinkCourse(id: string, folderPath: string) {
  return api.patch<{ course: Course }>(`/courses/${id}/relink`, { folderPath });
}

export function exploreLibrary(libraryId: string, path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  return api.get<ExploreResult>(`/libraries/${libraryId}/explore${query}`);
}

export function markCourseFolder(libraryId: string, folderPath: string) {
  return api.post<{ ok: true }>(`/libraries/${libraryId}/mark-course`, { folderPath });
}

export function getUsers() {
  return api.get<{ users: User[] }>("/users");
}

export interface UserProfilePatch {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  avatarId?: number | null;
}

export function createUser(
  username: string,
  password: string,
  role: "admin" | "user",
  profile: { firstName: string; lastName: string; email?: string | null; avatarId?: number | null },
) {
  return api.post<{ user: User }>("/users", { username, password, role, ...profile });
}

export function updateUserRole(id: string, role: "admin" | "user") {
  return api.patch<{ user: User }>(`/users/${id}/role`, { role });
}

// Admin has full rights over another user's profile fields — see
// authService.ts's updateProfile.
export function updateUserProfile(id: string, patch: UserProfilePatch) {
  return api.patch<{ user: User }>(`/users/${id}`, patch);
}

export function resetUserPassword(id: string, password: string) {
  return api.patch<void>(`/users/${id}/password`, { password });
}

export function deleteUser(id: string) {
  return api.delete<void>(`/users/${id}`);
}

export function getUserActivity(id: string) {
  return api.get<UserActivitySummary>(`/users/${id}/activity`);
}

export function createSection(title: string) {
  return api.post<{ section: Section }>("/sections", { title });
}

export function deleteSection(id: string) {
  return api.delete<void>(`/sections/${id}`);
}

export function getSectionAccess(id: string) {
  return api.get<{ userIds: string[] }>(`/sections/${id}/access`);
}

export function setSectionAccess(id: string, userIds: string[]) {
  return api.put<{ userIds: string[] }>(`/sections/${id}/access`, { userIds });
}

export function setSectionHidden(id: string, hidden: boolean) {
  return api.patch<{ section: Section }>(`/sections/${id}/hidden`, { hidden });
}

export function reorderSections(orderedSectionIds: string[]) {
  return api.post<{ sections: Section[] }>("/sections/reorder", { orderedSectionIds });
}

export function assignCourseSection(courseId: string, sectionId: string | null) {
  return api.patch<{ course: Course }>(`/courses/${courseId}/section`, { sectionId });
}

export function deleteCourse(id: string) {
  return api.delete<void>(`/courses/${id}`);
}

