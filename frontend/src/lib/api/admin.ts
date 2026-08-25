import type { BrowseResult, Library, ScanSummary, User } from "@lecturn/shared";
import { api } from "../apiClient";

export interface TopLevelEntry {
  kind: "section" | "course";
  id: number;
  title: string;
  folderPath: string;
}

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

export function getTopLevelEntries(libraryId: number) {
  return api.get<{ entries: TopLevelEntry[] }>(`/libraries/${libraryId}/top-level`);
}

export function reclassifyFolder(libraryId: number, folderPath: string, kind: "section" | "course") {
  return api.post<void>(`/libraries/${libraryId}/reclassify`, { folderPath, kind });
}

export function getMissingFiles(libraryId: number) {
  return api.get<{ missing: MissingEntry[] }>(`/libraries/${libraryId}/missing`);
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
