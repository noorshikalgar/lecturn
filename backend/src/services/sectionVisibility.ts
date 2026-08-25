import { getCourseById } from "../db/repositories/coursesRepo.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { listAllowedSectionIdsForUser, listRestrictedSectionIds } from "../db/repositories/sectionAccessRepo.js";

export interface RequestUser {
  id: number;
  role: "admin" | "user";
}

export interface SectionVisibility {
  canSeeSection(sectionId: number): boolean;
  // Unassigned courses (sectionId null) are only visible to admins — they
  // haven't been organized into a section yet.
  canSeeCourseSection(sectionId: number | null): boolean;
}

export function getSectionVisibility(user: RequestUser): SectionVisibility {
  if (user.role === "admin") {
    return { canSeeSection: () => true, canSeeCourseSection: () => true };
  }
  const restricted = listRestrictedSectionIds();
  const allowed = listAllowedSectionIdsForUser(user.id);
  function canSeeSection(sectionId: number): boolean {
    return !restricted.has(sectionId) || allowed.has(sectionId);
  }
  return {
    canSeeSection,
    canSeeCourseSection: (sectionId) => sectionId !== null && canSeeSection(sectionId),
  };
}

export function canUserAccessCourse(user: RequestUser, courseId: number): boolean {
  const course = getCourseById(courseId);
  if (!course) return false;
  return getSectionVisibility(user).canSeeCourseSection(course.sectionId);
}

export function canUserAccessNode(user: RequestUser, nodeId: number): boolean {
  const node = getNodeById(nodeId);
  if (!node) return false;
  return canUserAccessCourse(user, node.courseId);
}
