import { getCourseById } from "../db/repositories/coursesRepo.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { listAllowedSectionIdsForUser, listRestrictedSectionIds } from "../db/repositories/sectionAccessRepo.js";
import { listHiddenSectionIds } from "../db/repositories/sectionsRepo.js";

export interface RequestUser {
  id: number;
  role: "admin" | "user";
}

export interface SectionVisibility {
  canSeeSection(sectionId: number): boolean;
  canSeeCourse(course: { sectionId: number | null; hidden: boolean }): boolean;
}

export function getSectionVisibility(user: RequestUser): SectionVisibility {
  const hiddenSectionIds = listHiddenSectionIds();
  const restricted = listRestrictedSectionIds();
  const allowed = listAllowedSectionIdsForUser(user.id);

  // Admins bypass both hidden and the access allow-list entirely — they can
  // manage every section from the admin panel regardless, so a restricted
  // section that excluded its own admin would just be confusing (e.g. the
  // admin who created it, then restricted it to a handful of users, forgot
  // to grant themselves access, and can no longer see their own section).
  function canSeeSection(sectionId: number): boolean {
    if (user.role === "admin") return true;
    if (hiddenSectionIds.has(sectionId)) return false;
    if (!restricted.has(sectionId)) return true;
    return allowed.has(sectionId);
  }

  // Unassigned courses (sectionId null) are only visible to admins — they
  // haven't been organized into a section yet.
  function canSeeCourse(course: { sectionId: number | null; hidden: boolean }): boolean {
    if (user.role === "admin") return true;
    if (course.hidden) return false;
    if (course.sectionId === null) return false;
    return canSeeSection(course.sectionId);
  }

  return { canSeeSection, canSeeCourse };
}

export function canUserAccessCourse(user: RequestUser, courseId: number): boolean {
  const course = getCourseById(courseId);
  if (!course) return false;
  return getSectionVisibility(user).canSeeCourse(course);
}

export function canUserAccessNode(user: RequestUser, nodeId: number): boolean {
  const node = getNodeById(nodeId);
  if (!node) return false;
  return canUserAccessCourse(user, node.courseId);
}
