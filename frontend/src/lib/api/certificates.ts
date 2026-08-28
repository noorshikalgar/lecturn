import type { CourseCertificate } from "@lecturn/shared";
import { api } from "../apiClient";

export function markCourseComplete(courseId: number, completed: boolean) {
  return api.patch(`/certificates/${courseId}/complete`, { completed });
}

// Get-or-create: the first call for a completed course issues and signs it
// server-side; every call after that returns the exact same certificate.
export function getMyCertificate(courseId: number) {
  return api.get<{ certificate: CourseCertificate }>(`/course-certificates/${courseId}/mine`);
}
