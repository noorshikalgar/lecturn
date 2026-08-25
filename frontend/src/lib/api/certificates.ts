import { api } from "../apiClient";

export function markCourseComplete(courseId: number, completed: boolean) {
  return api.patch(`/certificates/${courseId}/complete`, { completed });
}
