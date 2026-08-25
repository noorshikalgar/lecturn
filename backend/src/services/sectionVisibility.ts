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

  // Hidden is an admin-only kill switch, independent of section_access —
  // it beats everything, but admins themselves still see through it so they
  // can manage/unhide it. The access allow-list, by contrast, applies
  // equally to everyone including admins: a restricted section is only
  // visible to users explicitly granted access, admin or not — admin role
  // alone no longer grants automatic access.
  function canSeeSection(sectionId: number): boolean {
    if (hiddenSectionIds.has(sectionId)) return user.role === "admin";
    if (!restricted.has(sectionId)) return true;
    return allowed.has(sectionId);
  }

  // Unassigned courses (sectionId null) are only visible to admins — they
  // haven't been organized into a section yet.
  function canSeeCourse(course: { sectionId: number | null; hidden: boolean }): boolean {
    if (course.hidden) return user.role === "admin";
    return course.sectionId !== null && canSeeSection(course.sectionId);
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
