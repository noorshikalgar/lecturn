import type { CourseNote, Note } from "@lecturn/shared";
import { api } from "../apiClient";

export function getNotesForVideo(videoNodeId: string) {
  return api.get<{ notes: Note[] }>(`/notes/video/${videoNodeId}`);
}

export function getNotesForCourse(courseId: string) {
  return api.get<{ notes: CourseNote[] }>(`/notes/course/${courseId}`);
}

export function createNote(videoNodeId: string, timestampSeconds: number | null, body: string) {
  return api.post<{ note: Note }>("/notes", { videoNodeId, timestampSeconds, body });
}

export function deleteNote(id: string) {
  return api.delete<void>(`/notes/${id}`);
}
