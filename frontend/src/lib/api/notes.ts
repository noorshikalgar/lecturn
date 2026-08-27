import type { CourseNote, Note } from "@lecturn/shared";
import { api } from "../apiClient";

export function getNotesForVideo(videoNodeId: number) {
  return api.get<{ notes: Note[] }>(`/notes/video/${videoNodeId}`);
}

export function getNotesForCourse(courseId: number) {
  return api.get<{ notes: CourseNote[] }>(`/notes/course/${courseId}`);
}

export function createNote(videoNodeId: number, timestampSeconds: number | null, body: string) {
  return api.post<{ note: Note }>("/notes", { videoNodeId, timestampSeconds, body });
}

export function deleteNote(id: number) {
  return api.delete<void>(`/notes/${id}`);
}
